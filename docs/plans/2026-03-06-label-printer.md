# GoForPrice Label Printer — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Windows desktop app that reads a local Excel file (via file picker or drag & drop) and prints Zebra labels (ZPL) or A4 landscape poster PDFs for selected products, with column auto-mapping and a print history.

**Architecture:** Single-window customtkinter app — left panel: search + results table + history; right panel: preview + print actions. All non-UI logic lives in `src/`. Config and history persisted to JSON files next to the executable.

**Tech Stack:** Python 3.11, customtkinter, tkinterdnd2, openpyxl, reportlab, Pillow, pywin32 (win32print, Windows only), PyInstaller

**Excel canonical columns:** `article`, `PA HTVA 2026`, `Pvente`, `Ppro`, `taux TVA`, `PPro HTVA`, `EAN`, `ORIGINE`, `P/L`
**Auto-mapping:** fuzzy-matches any header to canonical keys; unknown headers trigger a manual mapping dialog.

---

## Task 1: Project scaffold + dependencies

**Files:**
- Create: `requirements.txt`
- Create: `requirements-dev.txt`
- Create: `app.py`
- Create: `src/__init__.py`
- Create: `ui/__init__.py`
- Create: `tests/__init__.py`
- Create: `assets/` (empty dir)

**Step 1: Create `requirements.txt`**

```
customtkinter==5.2.2
tkinterdnd2==0.3.0
openpyxl==3.1.2
reportlab==4.2.0
Pillow==10.3.0
pywin32==306
pyinstaller==6.6.0
```

**Step 2: Create `requirements-dev.txt`**

```
pytest==8.1.1
pytest-mock==3.14.0
```

**Step 3: Create `app.py`**

```python
import sys
import os

if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

sys.path.insert(0, BASE_DIR)

from ui.main_window import MainWindow

if __name__ == "__main__":
    app = MainWindow(base_dir=BASE_DIR)
    app.run()
```

**Step 4: Create empty `__init__.py` files**

```bash
touch src/__init__.py ui/__init__.py tests/__init__.py
mkdir -p assets
```

**Step 5: Install dependencies**

```bash
pip install -r requirements.txt -r requirements-dev.txt
```

**Step 6: Commit**

```bash
git add .
git commit -m "feat: project scaffold and dependencies"
```

---

## Task 2: Config manager

**Files:**
- Create: `src/config_manager.py`
- Create: `tests/test_config_manager.py`

**Step 1: Write failing tests**

```python
# tests/test_config_manager.py
import json, os, pytest
from src.config_manager import ConfigManager

def test_defaults_when_no_file(tmp_path):
    cm = ConfigManager(config_path=str(tmp_path / "config.json"))
    assert cm.get("printer_type") == "usb"
    assert cm.get("label_size") == "60x35"
    assert cm.get("usb_printer") == ""
    assert cm.get("network_ip") == ""
    assert cm.get("last_excel_path") == ""

def test_save_and_reload(tmp_path):
    path = str(tmp_path / "config.json")
    cm = ConfigManager(config_path=path)
    cm.set("usb_printer", "Zebra ZD420")
    cm.save()
    cm2 = ConfigManager(config_path=path)
    assert cm2.get("usb_printer") == "Zebra ZD420"

def test_get_nonexistent_key_returns_none(tmp_path):
    cm = ConfigManager(config_path=str(tmp_path / "config.json"))
    assert cm.get("nonexistent") is None
```

**Step 2: Run test — verify FAIL**

```bash
pytest tests/test_config_manager.py -v
```

**Step 3: Implement `src/config_manager.py`**

```python
import json, os

DEFAULTS = {
    "printer_type":    "usb",
    "usb_printer":     "",
    "network_ip":      "",
    "label_size":      "60x35",
    "last_excel_path": "",
}

LABEL_SIZES = {
    "60x35":  {"width_mm": 60,  "height_mm": 35, "label": "60mm × 35mm (défaut)"},
    "50x30":  {"width_mm": 50,  "height_mm": 30, "label": "50mm × 30mm"},
    "100x50": {"width_mm": 100, "height_mm": 50, "label": "100mm × 50mm"},
    "75x50":  {"width_mm": 75,  "height_mm": 50, "label": "75mm × 50mm"},
}

class ConfigManager:
    def __init__(self, config_path: str):
        self._path = config_path
        self._data = dict(DEFAULTS)
        if os.path.exists(config_path):
            try:
                with open(config_path, "r", encoding="utf-8") as f:
                    self._data.update(json.load(f))
            except (json.JSONDecodeError, OSError):
                pass

    def get(self, key: str):
        return self._data.get(key)

    def set(self, key: str, value):
        self._data[key] = value

    def save(self):
        with open(self._path, "w", encoding="utf-8") as f:
            json.dump(self._data, f, indent=2, ensure_ascii=False)

    def get_label_size_info(self) -> dict:
        key = self._data.get("label_size", "60x35")
        return LABEL_SIZES.get(key, LABEL_SIZES["60x35"])
```

**Step 4: Run test — verify PASS**

```bash
pytest tests/test_config_manager.py -v
```

**Step 5: Commit**

```bash
git add src/config_manager.py tests/test_config_manager.py
git commit -m "feat: config manager with defaults and persistence"
```

---

## Task 3: Column auto-mapper

**Files:**
- Create: `src/column_mapper.py`
- Create: `tests/test_column_mapper.py`
- Create: `ui/mapping_dialog.py`

**Logic:** 3-pass resolution — exact (case-insensitive) → synonym substring → fuzzy (difflib).
If required fields remain unresolved, a dialog lets the user assign manually.

**Required fields** (app cannot run without): `article`, `pvente`, `ppro`, `ppro_htva`
**Optional fields**: `origine`, `p_l`, `pa_htva`, `taux_tva`, `ean`

**Step 1: Write failing tests**

```python
# tests/test_column_mapper.py
import pytest
from src.column_mapper import ColumnMapper

def test_exact_canonical_headers():
    headers = ["article", "Pvente", "Ppro", "PPro HTVA", "ORIGINE", "P/L"]
    m = ColumnMapper.auto_map(headers)
    assert m["article"]   == "article"
    assert m["pvente"]    == "Pvente"
    assert m["ppro"]      == "Ppro"
    assert m["ppro_htva"] == "PPro HTVA"
    assert m["origine"]   == "ORIGINE"
    assert m["p_l"]       == "P/L"

def test_case_insensitive():
    headers = ["ARTICLE", "PVENTE", "PPRO", "PPRO HTVA"]
    m = ColumnMapper.auto_map(headers)
    assert m["article"] == "ARTICLE"
    assert m["pvente"]  == "PVENTE"

def test_synonym_match():
    headers = ["Nom", "Prix de vente", "Prix pro ttc", "Prix pro htva"]
    m = ColumnMapper.auto_map(headers)
    assert m["article"]   == "Nom"
    assert m["pvente"]    == "Prix de vente"
    assert m["ppro"]      == "Prix pro ttc"
    assert m["ppro_htva"] == "Prix pro htva"

def test_fuzzy_match():
    headers = ["artikle", "Pventes", "Ppros", "PPro HTVAS"]
    m = ColumnMapper.auto_map(headers)
    assert m.get("article") == "artikle"

def test_unresolved_returns_none():
    m = ColumnMapper.auto_map(["foo", "bar"])
    assert m.get("article") is None

def test_missing_required_detected():
    missing = ColumnMapper.missing_required(ColumnMapper.auto_map(["foo"]))
    assert "article" in missing
    assert "pvente"  in missing
```

**Step 2: Run — verify FAIL**

```bash
pytest tests/test_column_mapper.py -v
```

**Step 3: Implement `src/column_mapper.py`**

```python
import difflib
from typing import Dict, List, Optional

SYNONYMS: Dict[str, List[str]] = {
    "article":   ["article", "nom", "libellé", "libelle", "désignation",
                  "designation", "description", "produit"],
    "pvente":    ["pvente", "pv ", "prix vente", "prix de vente",
                  "selling price", "vente"],
    "ppro":      ["ppro", "pprottc", "ppro ttc", "prix pro ttc", "pro ttc"],
    "ppro_htva": ["ppro htva", "pprohtva", "ppro_htva", "prix pro htva",
                  "pro htva", "ppht"],
    "origine":   ["origine", "origin", "pays", "country"],
    "p_l":       ["p/l", "p_l", "prix/litre", "prix litre", "prix/l", "pl"],
    "pa_htva":   ["pa htva", "pa_htva", "prix achat", "pa 2026", "pa htva 2026"],
    "taux_tva":  ["taux tva", "taux_tva", "tva", "vat"],
    "ean":       ["ean", "barcode", "code barre", "code-barre"],
}

REQUIRED = ["article", "pvente", "ppro", "ppro_htva"]


class ColumnMapper:
    @staticmethod
    def auto_map(headers: List[str]) -> Dict[str, Optional[str]]:
        used: set = set()
        mapping: Dict[str, Optional[str]] = {k: None for k in SYNONYMS}
        headers_lower = [h.lower().strip() if h else "" for h in headers]

        def _assign(key, header):
            mapping[key] = header
            used.add(header)

        # Pass 1 — exact + synonym substring
        for key, synonyms in SYNONYMS.items():
            for i, hl in enumerate(headers_lower):
                if headers[i] in used:
                    continue
                if hl in synonyms or any(syn in hl for syn in synonyms):
                    _assign(key, headers[i])
                    break

        # Pass 2 — fuzzy fallback
        all_syn_flat = {syn: key for key, syns in SYNONYMS.items() for syn in syns}
        for key in SYNONYMS:
            if mapping[key] is not None:
                continue
            for i, hl in enumerate(headers_lower):
                if headers[i] in used:
                    continue
                matches = difflib.get_close_matches(
                    hl, all_syn_flat.keys(), n=1, cutoff=0.75)
                if matches and all_syn_flat[matches[0]] == key:
                    _assign(key, headers[i])
                    break

        return mapping

    @staticmethod
    def missing_required(mapping: Dict[str, Optional[str]]) -> List[str]:
        return [k for k in REQUIRED if not mapping.get(k)]

    @staticmethod
    def apply(mapping: Dict[str, Optional[str]], raw_row: dict) -> dict:
        inv = {v: k for k, v in mapping.items() if v is not None}
        return {inv.get(h, h): val for h, val in raw_row.items()}
```

**Step 4: Implement `ui/mapping_dialog.py`**

```python
import customtkinter as ctk
from typing import Dict, List, Optional


class MappingDialog(ctk.CTkToplevel):
    FIELD_LABELS = {
        "article":   "Nom article *",
        "pvente":    "Prix de vente *",
        "ppro":      "Prix pro TTC *",
        "ppro_htva": "Prix pro HTVA *",
        "origine":   "Origine  (optionnel)",
        "p_l":       "Prix/L   (optionnel)",
    }

    def __init__(self, parent, headers: List[str],
                 current_mapping: Dict[str, Optional[str]]):
        super().__init__(parent)
        self.title("Correspondance des colonnes")
        self.geometry("460x380")
        self.resizable(False, False)
        self.grab_set()
        self._headers = ["(ignoré)"] + headers
        self._mapping = dict(current_mapping)
        self.result: Optional[Dict[str, Optional[str]]] = None
        self._vars: Dict[str, ctk.StringVar] = {}
        self._build()

    def _build(self):
        ctk.CTkLabel(self, text="Associez chaque champ requis (*) à une colonne Excel :",
                     wraplength=420).pack(padx=16, pady=(14, 4))
        frame = ctk.CTkScrollableFrame(self)
        frame.pack(fill="both", expand=True, padx=16, pady=8)
        for key, label in self.FIELD_LABELS.items():
            row = ctk.CTkFrame(frame, fg_color="transparent")
            row.pack(fill="x", pady=4)
            ctk.CTkLabel(row, text=label, width=170, anchor="w").pack(side="left")
            current = self._mapping.get(key) or "(ignoré)"
            var = ctk.StringVar(value=current)
            self._vars[key] = var
            ctk.CTkOptionMenu(row, values=self._headers, variable=var,
                              width=230).pack(side="left", padx=8)
        ctk.CTkButton(self, text="Confirmer", command=self._confirm).pack(pady=12)

    def _confirm(self):
        for key, var in self._vars.items():
            val = var.get()
            self._mapping[key] = None if val == "(ignoré)" else val
        self.result = self._mapping
        self.destroy()
```

**Step 5: Run tests — verify PASS**

```bash
pytest tests/test_column_mapper.py -v
```

**Step 6: Commit**

```bash
git add src/column_mapper.py ui/mapping_dialog.py tests/test_column_mapper.py
git commit -m "feat: column auto-mapper with fuzzy matching and manual dialog"
```

---

## Task 4: Excel reader (uses auto-mapper)

**Files:**
- Create: `src/excel_reader.py`
- Create: `tests/test_excel_reader.py`

**Step 1: Write failing tests**

```python
# tests/test_excel_reader.py
import pytest, openpyxl
from src.excel_reader import ExcelReader

SAMPLE = "yves.xlsx"

def test_loads_canonical_file():
    r = ExcelReader(SAMPLE)
    rows = r.all_rows()
    assert len(rows) >= 1
    first = rows[0]
    for key in ("article", "pvente", "ppro", "ppro_htva", "origine", "p_l"):
        assert key in first

def test_search_case_insensitive():
    r = ExcelReader(SAMPLE)
    results = r.search("red bull")
    assert len(results) >= 1
    assert all("red bull" in x["article"].lower() for x in results)

def test_search_empty_returns_all():
    r = ExcelReader(SAMPLE)
    assert len(r.search("")) == len(r.all_rows())

def test_pvente_is_float():
    r = ExcelReader(SAMPLE)
    assert isinstance(r.all_rows()[0]["pvente"], float)

def test_format_price():
    assert ExcelReader.format_price(26.99) == "26,99"
    assert ExcelReader.format_price(1.0)   == "1,00"

def test_auto_maps_non_canonical_headers(tmp_path):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Nom", "Prix de vente", "Prix pro ttc", "Prix pro htva",
               "TVA", "Code barre", "Pays", "Prix/Litre", "PA"])
    ws.append(["Test Article", 9.99, 8.99, 8.48, 6, 123456, "France", "2,50€/L", 7.0])
    path = str(tmp_path / "test.xlsx")
    wb.save(path)
    r = ExcelReader(path)
    rows = r.all_rows()
    assert rows[0]["article"] == "Test Article"
    assert rows[0]["pvente"]  == 9.99
    assert rows[0]["origine"] == "France"
```

**Step 2: Run — verify FAIL**

```bash
pytest tests/test_excel_reader.py -v
```

**Step 3: Implement `src/excel_reader.py`**

```python
import openpyxl
from typing import List, Dict, Optional, Callable
from src.column_mapper import ColumnMapper


class ExcelReader:
    def __init__(self, path: str,
                 mapping_override: Optional[Dict] = None,
                 on_mapping_needed: Optional[Callable] = None):
        """
        path: .xlsx file
        mapping_override: pre-resolved mapping (from MappingDialog)
        on_mapping_needed: callback(headers, mapping) → dict | None
                           called when required fields can't be auto-mapped
        """
        self._path = path
        self._mapping_override = mapping_override
        self._on_mapping_needed = on_mapping_needed
        self._rows: List[Dict] = []
        self._headers: List[str] = []
        self._resolved_mapping: Dict = {}
        self._load()

    def _load(self):
        wb = openpyxl.load_workbook(self._path, read_only=True, data_only=True)
        ws = wb.active
        self._headers = [str(c.value).strip() if c.value else "" for c in ws[1]]

        mapping = (self._mapping_override
                   or ColumnMapper.auto_map(self._headers))

        missing = ColumnMapper.missing_required(mapping)
        if missing and self._on_mapping_needed:
            result = self._on_mapping_needed(self._headers, mapping)
            if result:
                mapping = result

        self._resolved_mapping = mapping
        inv = {v: k for k, v in mapping.items() if v is not None}

        self._rows = []
        for row in ws.iter_rows(min_row=2, values_only=True):
            if all(v is None for v in row):
                continue
            raw = {self._headers[i]: row[i]
                   for i in range(min(len(self._headers), len(row)))}
            record: Dict = {inv.get(h, h): v for h, v in raw.items()}

            for pk in ("pvente", "ppro", "ppro_htva", "pa_htva"):
                if isinstance(record.get(pk), (int, float)):
                    record[pk] = float(record[pk])
                else:
                    try:
                        record[pk] = float(
                            str(record.get(pk, 0))
                            .replace(",", ".").replace("€", "").strip())
                    except (ValueError, TypeError):
                        record[pk] = 0.0

            for sk in ("article", "origine", "p_l"):
                record[sk] = str(record.get(sk) or "").strip()

            self._rows.append(record)
        wb.close()

    def reload(self, mapping_override=None):
        if mapping_override:
            self._mapping_override = mapping_override
        self._load()

    @property
    def headers(self) -> List[str]:
        return self._headers

    @property
    def resolved_mapping(self) -> Dict:
        return self._resolved_mapping

    def all_rows(self) -> List[Dict]:
        return list(self._rows)

    def search(self, query: str) -> List[Dict]:
        if not query:
            return self.all_rows()
        q = query.lower().strip()
        return [r for r in self._rows if q in r.get("article", "").lower()]

    def suggestions(self, query: str, limit: int = 8) -> List[str]:
        if not query:
            return []
        q = query.lower().strip()
        return [r["article"] for r in self._rows
                if q in r.get("article", "").lower()][:limit]

    @staticmethod
    def format_price(value: float) -> str:
        return f"{value:.2f}".replace(".", ",")
```

**Step 4: Run tests — verify PASS**

```bash
pytest tests/test_excel_reader.py -v
```

**Step 5: Commit**

```bash
git add src/excel_reader.py tests/test_excel_reader.py
git commit -m "feat: excel reader with auto-mapping integration"
```

---

## Task 5: ZPL generator

**Files:**
- Create: `src/zpl_generator.py`
- Create: `tests/test_zpl_generator.py`

**ZPL reference:** Zebra 203 DPI → 1mm ≈ 8 dots. `^PW` = width dots, `^LL` = length dots.

**Step 1: Write failing tests**

```python
# tests/test_zpl_generator.py
import pytest
from src.zpl_generator import ZplGenerator

P = {"article": "Red Bull 24x25cl", "pvente": 26.99,
     "ppro": 25.99, "ppro_htva": 24.52}

def test_zpl_envelope():
    zpl = ZplGenerator.generate(P, 60, 35)
    assert zpl.startswith("^XA")
    assert zpl.endswith("^XZ")

def test_contains_article():
    assert "Red Bull 24x25cl" in ZplGenerator.generate(P, 60, 35)

def test_price_with_euro():
    zpl = ZplGenerator.generate(P, 60, 35)
    assert "26,99" in zpl
    assert "\u20ac" in zpl

def test_pro_prices_no_euro():
    zpl = ZplGenerator.generate(P, 60, 35)
    assert "PPHT 24,52" in zpl
    assert "PPTTC 25,99" in zpl
    pro_line = next(l for l in zpl.split("\n") if "PPHT" in l)
    assert "\u20ac" not in pro_line

def test_label_dimensions_60x35():
    zpl = ZplGenerator.generate(P, 60, 35)
    assert "^PW480" in zpl
    assert "^LL280" in zpl

def test_label_dimensions_100x50():
    zpl = ZplGenerator.generate(P, 100, 50)
    assert "^PW800" in zpl
    assert "^LL400" in zpl
```

**Step 2: Run — verify FAIL**

```bash
pytest tests/test_zpl_generator.py -v
```

**Step 3: Implement `src/zpl_generator.py`**

```python
DOTS_PER_MM = 8

class ZplGenerator:
    @staticmethod
    def generate(product: dict, width_mm: int, height_mm: int) -> str:
        pw = width_mm  * DOTS_PER_MM
        ll = height_mm * DOTS_PER_MM

        article   = str(product.get("article", "")).strip()
        pvente    = float(product.get("pvente",    0))
        ppro      = float(product.get("ppro",      0))
        ppro_htva = float(product.get("ppro_htva", 0))

        price_str = f"{pvente:.2f}".replace(".", ",") + "\u20ac"
        pro_line  = (f"PPHT {ppro_htva:.2f}".replace(".", ",") +
                     f"  PPTTC {ppro:.2f}".replace(".", ","))

        fa = max(18, int(ll * 0.10))   # article font
        fp = max(40, int(ll * 0.22))   # price font
        fs = max(14, int(ll * 0.07))   # small font

        ya = 10
        yp = int(ll * 0.30)
        ys = int(ll * 0.80)

        return (
            f"^XA\n^PW{pw}\n^LL{ll}\n"
            f"^CF0,{fa}\n^FO20,{ya}^FD{article}^FS\n"
            f"^CF0,{fp}\n^FO20,{yp}^FD{price_str}^FS\n"
            f"^CF0,{fs}\n^FO20,{ys}^FD{pro_line}^FS\n"
            f"^XZ"
        )
```

**Step 4: Run tests — verify PASS**

```bash
pytest tests/test_zpl_generator.py -v
```

**Step 5: Commit**

```bash
git add src/zpl_generator.py tests/test_zpl_generator.py
git commit -m "feat: ZPL generator with dynamic sizing"
```

---

## Task 6: PDF / A4 poster generator

**Files:**
- Create: `src/pdf_generator.py`
- Create: `tests/test_pdf_generator.py`

**A4 landscape layout (297 × 210mm):**
```
┌──────────────────────────────────────────────┐
│ [LOGO]   Article name (large bold)           │
│                                              │
│                  29,99€  (very large)        │
│                                              │
│  P/L: 4,50€/L              Origine: Belgique │
│                    PPHT 24,52  PPTTC 25,99   │
└──────────────────────────────────────────────┘
```

**Step 1: Write failing tests**

```python
# tests/test_pdf_generator.py
import os, pytest
from src.pdf_generator import PdfGenerator

P = {"article": "Red Bull 24x25cl", "pvente": 26.99,
     "ppro": 25.99, "ppro_htva": 24.52,
     "origine": "Belgique", "p_l": "4,50€/L"}

def test_generates_pdf(tmp_path):
    out = str(tmp_path / "poster.pdf")
    PdfGenerator.generate_a4(P, out, logo_path=None)
    assert os.path.exists(out)
    assert os.path.getsize(out) > 1000

def test_returns_path(tmp_path):
    out = str(tmp_path / "p.pdf")
    assert PdfGenerator.generate_a4(P, out, logo_path=None) == out

def test_generates_with_logo(tmp_path):
    # create a tiny 1x1 PNG as dummy logo
    from PIL import Image
    logo = str(tmp_path / "logo.png")
    Image.new("RGB", (10, 10), color="red").save(logo)
    out = str(tmp_path / "poster_logo.pdf")
    PdfGenerator.generate_a4(P, out, logo_path=logo)
    assert os.path.exists(out)
```

**Step 2: Run — verify FAIL**

```bash
pytest tests/test_pdf_generator.py -v
```

**Step 3: Implement `src/pdf_generator.py`**

```python
import os
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as rl_canvas

PAGE_W, PAGE_H = landscape(A4)
MARGIN = 15 * mm


class PdfGenerator:
    @staticmethod
    def generate_a4(product: dict, output_path: str,
                    logo_path: str | None) -> str:
        article   = str(product.get("article", "")).strip()
        pvente    = float(product.get("pvente",    0))
        ppro      = float(product.get("ppro",      0))
        ppro_htva = float(product.get("ppro_htva", 0))
        origine   = str(product.get("origine", "")).strip()
        p_l       = str(product.get("p_l", "")).strip()

        price_str = f"{pvente:.2f}".replace(".", ",") + "\u20ac"
        ppht_str  = f"{ppro_htva:.2f}".replace(".", ",")
        ppttc_str = f"{ppro:.2f}".replace(".", ",")

        c = rl_canvas.Canvas(output_path, pagesize=landscape(A4))

        # Logo — top-left
        logo_w, logo_h = 35 * mm, 25 * mm
        logo_x = MARGIN
        logo_y = PAGE_H - MARGIN - logo_h
        if logo_path and os.path.exists(logo_path):
            c.drawImage(logo_path, logo_x, logo_y,
                        width=logo_w, height=logo_h,
                        preserveAspectRatio=True, mask="auto")

        # Article name — top, beside logo
        c.setFont("Helvetica-Bold", 28)
        c.setFillColor(colors.black)
        c.drawString(MARGIN + logo_w + 10 * mm,
                     PAGE_H - MARGIN - 18 * mm, article)

        # Price — centre, very large
        c.setFont("Helvetica-Bold", 80)
        c.drawCentredString(PAGE_W / 2, PAGE_H / 2 - 20 * mm, price_str)

        # P/L — bottom-left
        c.setFont("Helvetica", 18)
        c.drawString(MARGIN, MARGIN + 14 * mm, f"P/L : {p_l}")

        # Origine — bottom-right
        c.drawRightString(PAGE_W - MARGIN, MARGIN + 14 * mm,
                          f"Origine : {origine}")

        # Pro prices — bottom-right, small
        c.setFont("Helvetica", 13)
        c.drawRightString(PAGE_W - MARGIN, MARGIN,
                          f"PPHT {ppht_str}    PPTTC {ppttc_str}")

        c.save()
        return output_path
```

**Step 4: Run tests — verify PASS**

```bash
pytest tests/test_pdf_generator.py -v
```

**Step 5: Commit**

```bash
git add src/pdf_generator.py tests/test_pdf_generator.py
git commit -m "feat: A4 landscape poster PDF generator"
```

---

## Task 7: Printer module

**Files:**
- Create: `src/printer.py`
- Create: `tests/test_printer.py`

> `win32print` is Windows-only. Tests mock it so they run on any OS.

**Step 1: Write failing tests**

```python
# tests/test_printer.py
import pytest
from unittest.mock import patch, MagicMock
from src.printer import ZebraPrinter

ZPL = "^XA^FDtest^FS^XZ"

def test_usb_print_calls_win32print():
    mock_w32 = MagicMock()
    mock_w32.OpenPrinter.return_value = 1
    with patch.dict("sys.modules", {"win32print": mock_w32}):
        from importlib import reload
        import src.printer; reload(src.printer)
        from src.printer import ZebraPrinter as Z
        Z.print_usb(ZPL, "Zebra ZD420")
    mock_w32.OpenPrinter.assert_called_once_with("Zebra ZD420")
    mock_w32.WritePrinter.assert_called_once()

def test_network_print_sends_bytes():
    mock_sock = MagicMock()
    mock_sock.__enter__ = MagicMock(return_value=mock_sock)
    mock_sock.__exit__  = MagicMock(return_value=False)
    with patch("socket.socket", return_value=mock_sock):
        ZebraPrinter.print_network(ZPL, "192.168.1.100", 9100)
    mock_sock.connect.assert_called_once_with(("192.168.1.100", 9100))
    mock_sock.sendall.assert_called_once_with(ZPL.encode("utf-8"))

def test_network_raises_on_bad_host():
    with pytest.raises(OSError):
        ZebraPrinter.print_network(ZPL, "0.0.0.0", 1)

def test_list_printers_returns_names():
    mock_w32 = MagicMock()
    mock_w32.EnumPrinters.return_value = [
        (0, "", "Zebra ZD420", ""),
        (0, "", "Microsoft Print to PDF", ""),
    ]
    mock_w32.PRINTER_ENUM_LOCAL = 2
    mock_w32.PRINTER_ENUM_CONNECTIONS = 4
    with patch.dict("sys.modules", {"win32print": mock_w32}):
        from importlib import reload
        import src.printer; reload(src.printer)
        from src.printer import ZebraPrinter as Z
        result = Z.list_usb_printers()
    assert "Zebra ZD420" in result
```

**Step 2: Run — verify FAIL**

```bash
pytest tests/test_printer.py -v
```

**Step 3: Implement `src/printer.py`**

```python
import socket
from typing import List

try:
    import win32print
    WIN32_AVAILABLE = True
except ImportError:
    WIN32_AVAILABLE = False


class ZebraPrinter:
    @staticmethod
    def print_usb(zpl: str, printer_name: str) -> None:
        if not WIN32_AVAILABLE:
            raise RuntimeError("win32print not available (Windows only)")
        handle = win32print.OpenPrinter(printer_name)
        try:
            win32print.StartDocPrinter(handle, 1, ("ZPL Label", None, "RAW"))
            win32print.StartPagePrinter(handle)
            win32print.WritePrinter(handle, zpl.encode("utf-8"))
            win32print.EndPagePrinter(handle)
            win32print.EndDocPrinter(handle)
        finally:
            win32print.ClosePrinter(handle)

    @staticmethod
    def print_network(zpl: str, host: str, port: int = 9100) -> None:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(5)
            s.connect((host, port))
            s.sendall(zpl.encode("utf-8"))

    @staticmethod
    def list_usb_printers() -> List[str]:
        if not WIN32_AVAILABLE:
            return []
        flags = (win32print.PRINTER_ENUM_LOCAL |
                 win32print.PRINTER_ENUM_CONNECTIONS)
        return [p[2] for p in win32print.EnumPrinters(flags)]

    @staticmethod
    def open_pdf_and_print(pdf_path: str) -> None:
        import os
        os.startfile(pdf_path)
```

**Step 4: Run tests — verify PASS**

```bash
pytest tests/test_printer.py -v
```

**Step 5: Commit**

```bash
git add src/printer.py tests/test_printer.py
git commit -m "feat: printer module — USB win32print and TCP network"
```

---

## Task 8: Print history manager

**Files:**
- Create: `src/history_manager.py`
- Create: `tests/test_history_manager.py`

**What is stored per entry:**
```json
{
  "timestamp": "2026-03-06 14:32",
  "article": "Red Bull 24x25cl",
  "pvente": 26.99,
  "ppro": 25.99,
  "ppro_htva": 24.52,
  "origine": "Belgique",
  "p_l": "4,50€/L",
  "format": "label"   // "label" or "a4"
}
```

History is stored in `history.json` next to the executable. Max 100 entries (oldest dropped).

**Step 1: Write failing tests**

```python
# tests/test_history_manager.py
import json, pytest
from src.history_manager import HistoryManager

P = {"article": "Red Bull 24x25cl", "pvente": 26.99,
     "ppro": 25.99, "ppro_htva": 24.52,
     "origine": "Belgique", "p_l": "4,50€/L"}

def test_add_and_list(tmp_path):
    hm = HistoryManager(str(tmp_path / "history.json"))
    hm.add(P, fmt="label")
    entries = hm.list()
    assert len(entries) == 1
    assert entries[0]["article"] == "Red Bull 24x25cl"
    assert entries[0]["format"] == "label"
    assert "timestamp" in entries[0]

def test_most_recent_first(tmp_path):
    hm = HistoryManager(str(tmp_path / "history.json"))
    hm.add({**P, "article": "First"},  fmt="label")
    hm.add({**P, "article": "Second"}, fmt="a4")
    entries = hm.list()
    assert entries[0]["article"] == "Second"

def test_persists_across_reload(tmp_path):
    path = str(tmp_path / "history.json")
    hm = HistoryManager(path)
    hm.add(P, fmt="a4")
    hm2 = HistoryManager(path)
    assert len(hm2.list()) == 1

def test_max_100_entries(tmp_path):
    hm = HistoryManager(str(tmp_path / "history.json"))
    for i in range(110):
        hm.add({**P, "article": f"Art {i}"}, fmt="label")
    assert len(hm.list()) == 100
    assert hm.list()[0]["article"] == "Art 109"
```

**Step 2: Run — verify FAIL**

```bash
pytest tests/test_history_manager.py -v
```

**Step 3: Implement `src/history_manager.py`**

```python
import json, os
from datetime import datetime
from typing import List, Dict

MAX_ENTRIES = 100
KEEP_KEYS = ("article", "pvente", "ppro", "ppro_htva", "origine", "p_l")


class HistoryManager:
    def __init__(self, history_path: str):
        self._path = history_path
        self._entries: List[Dict] = []
        if os.path.exists(history_path):
            try:
                with open(history_path, "r", encoding="utf-8") as f:
                    self._entries = json.load(f)
            except (json.JSONDecodeError, OSError):
                self._entries = []

    def add(self, product: dict, fmt: str) -> None:
        entry = {k: product.get(k) for k in KEEP_KEYS}
        entry["format"]    = fmt
        entry["timestamp"] = datetime.now().strftime("%Y-%m-%d %H:%M")
        self._entries.insert(0, entry)
        if len(self._entries) > MAX_ENTRIES:
            self._entries = self._entries[:MAX_ENTRIES]
        self._save()

    def list(self) -> List[Dict]:
        return list(self._entries)

    def _save(self):
        with open(self._path, "w", encoding="utf-8") as f:
            json.dump(self._entries, f, indent=2, ensure_ascii=False)
```

**Step 4: Run tests — verify PASS**

```bash
pytest tests/test_history_manager.py -v
```

**Step 5: Commit**

```bash
git add src/history_manager.py tests/test_history_manager.py
git commit -m "feat: print history manager (max 100, persisted to JSON)"
```

---

## Task 9: Copy logo asset

**Files:**
- Create: `assets/logo.png`

**Step 1: Convert HEIC → PNG (on Mac during development)**

```bash
sips -s format png "IMG_6282.HEIC" --out assets/logo.png
```

On Windows: manually place `logo.png` in the `assets/` folder.

**Step 2: Verify**

```bash
python -c "from PIL import Image; img = Image.open('assets/logo.png'); print(img.size)"
```

**Step 3: Commit**

```bash
git add assets/logo.png
git commit -m "feat: GoForPrice logo asset"
```

---

## Task 10: Main window UI (drag & drop + history)

**Files:**
- Create: `ui/main_window.py`
- Create: `ui/settings_dialog.py`

**Drag & drop:** The whole window registers as a drop target via `tkinterdnd2`.
When the user drops a `.xlsx` file anywhere on the window, it loads automatically.
A dashed drop-zone banner is shown at the top when no file is loaded.

**History panel:** Collapsible sidebar below the results table.
Each entry shows timestamp, article name, format badge (ÉTIQ / A4).
Clicking an entry re-selects that product and format.

**Step 1: Create `ui/settings_dialog.py`**

```python
import customtkinter as ctk
from src.config_manager import ConfigManager, LABEL_SIZES
from src.printer import ZebraPrinter


class SettingsDialog(ctk.CTkToplevel):
    def __init__(self, parent, config: ConfigManager):
        super().__init__(parent)
        self.title("Paramètres")
        self.geometry("420x320")
        self.resizable(False, False)
        self.grab_set()
        self._config = config
        self._build()

    def _build(self):
        pad = {"padx": 16, "pady": 8}

        ctk.CTkLabel(self, text="Type d'imprimante :").grid(
            row=0, column=0, sticky="w", **pad)
        self._printer_type = ctk.StringVar(value=self._config.get("printer_type"))
        ctk.CTkRadioButton(self, text="USB", variable=self._printer_type,
                           value="usb",     command=self._toggle).grid(
                               row=0, column=1, **pad)
        ctk.CTkRadioButton(self, text="Réseau", variable=self._printer_type,
                           value="network", command=self._toggle).grid(
                               row=0, column=2, **pad)

        ctk.CTkLabel(self, text="Imprimante USB :").grid(
            row=1, column=0, sticky="w", **pad)
        printers = ZebraPrinter.list_usb_printers() or ["(aucune)"]
        self._usb_var = ctk.StringVar(
            value=self._config.get("usb_printer") or printers[0])
        self._usb_menu = ctk.CTkOptionMenu(
            self, values=printers, variable=self._usb_var)
        self._usb_menu.grid(row=1, column=1, columnspan=2, sticky="ew", **pad)

        ctk.CTkLabel(self, text="IP réseau :").grid(
            row=2, column=0, sticky="w", **pad)
        self._ip_var = ctk.StringVar(value=self._config.get("network_ip") or "")
        self._ip_entry = ctk.CTkEntry(
            self, textvariable=self._ip_var,
            placeholder_text="192.168.1.100")
        self._ip_entry.grid(row=2, column=1, columnspan=2, sticky="ew", **pad)

        ctk.CTkLabel(self, text="Format étiquette :").grid(
            row=3, column=0, sticky="w", **pad)
        size_labels = [v["label"] for v in LABEL_SIZES.values()]
        cur_key     = self._config.get("label_size") or "60x35"
        self._size_var = ctk.StringVar(value=LABEL_SIZES[cur_key]["label"])
        ctk.CTkOptionMenu(self, values=size_labels,
                          variable=self._size_var).grid(
                              row=3, column=1, columnspan=2, sticky="ew", **pad)

        ctk.CTkButton(self, text="Enregistrer",
                      command=self._save).grid(
                          row=4, column=0, columnspan=3, pady=16)
        self._toggle()

    def _toggle(self):
        if self._printer_type.get() == "usb":
            self._usb_menu.configure(state="normal")
            self._ip_entry.configure(state="disabled")
        else:
            self._usb_menu.configure(state="disabled")
            self._ip_entry.configure(state="normal")

    def _save(self):
        self._config.set("printer_type", self._printer_type.get())
        self._config.set("usb_printer",  self._usb_var.get())
        self._config.set("network_ip",   self._ip_var.get())
        label = self._size_var.get()
        key   = next((k for k, v in LABEL_SIZES.items()
                      if v["label"] == label), "60x35")
        self._config.set("label_size", key)
        self._config.save()
        self.destroy()
```

**Step 2: Create `ui/main_window.py`**

```python
import os, tempfile
import customtkinter as ctk
from tkinter import filedialog, messagebox
from tkinterdnd2 import TkinterDnD, DND_FILES

from src.config_manager  import ConfigManager
from src.excel_reader    import ExcelReader
from src.zpl_generator   import ZplGenerator
from src.pdf_generator   import PdfGenerator
from src.printer         import ZebraPrinter
from src.history_manager import HistoryManager
from src.column_mapper   import ColumnMapper
from ui.settings_dialog  import SettingsDialog
from ui.mapping_dialog   import MappingDialog

ctk.set_appearance_mode("light")
ctk.set_default_color_theme("blue")


class MainWindow:
    def __init__(self, base_dir: str):
        self._base_dir = base_dir
        self._config  = ConfigManager(os.path.join(base_dir, "config.json"))
        self._history = HistoryManager(os.path.join(base_dir, "history.json"))
        self._reader:           ExcelReader | None = None
        self._selected_product: dict        | None = None
        self._suggestion_btns:  list               = []

        # Use TkinterDnD as root to enable drag & drop
        self._root = TkinterDnD.Tk()
        ctk.set_appearance_mode("light")
        self._root.title("GoForPrice — Impression étiquettes")
        self._root.geometry("1150x700")

        self._build_ui()

        # Register entire window as drop target
        self._root.drop_target_register(DND_FILES)
        self._root.dnd_bind("<<Drop>>", self._on_file_drop)

        # Auto-load last Excel
        last = self._config.get("last_excel_path")
        if last and os.path.exists(last):
            self._load_excel(last)

    # ── UI construction ──────────────────────────────────────────

    def _build_ui(self):
        # Top bar
        top = ctk.CTkFrame(self._root, height=60, corner_radius=0)
        top.pack(fill="x", padx=0, pady=0)

        logo_path = os.path.join(self._base_dir, "assets", "logo.png")
        if os.path.exists(logo_path):
            from PIL import Image
            img = ctk.CTkImage(Image.open(logo_path), size=(130, 44))
            ctk.CTkLabel(top, image=img, text="").pack(side="left", padx=12)
        else:
            ctk.CTkLabel(top, text="GoForPrice",
                         font=("Helvetica", 22, "bold")).pack(
                             side="left", padx=12)

        ctk.CTkButton(top, text="📂 Charger Excel",
                      command=self._browse_excel, width=150).pack(
                          side="left", padx=8)
        self._file_label = ctk.CTkLabel(
            top, text="Glissez un fichier .xlsx ici ou cliquez Charger",
            text_color="gray")
        self._file_label.pack(side="left", padx=8)
        ctk.CTkButton(top, text="⚙ Paramètres",
                      command=self._open_settings, width=120).pack(
                          side="right", padx=10)

        # Drag & drop hint banner (hidden once file loaded)
        self._dnd_banner = ctk.CTkFrame(
            self._root, height=40, fg_color="#EEF4FF", corner_radius=0)
        self._dnd_banner.pack(fill="x")
        ctk.CTkLabel(
            self._dnd_banner,
            text="⬇  Glissez votre fichier Excel n'importe où dans la fenêtre",
            text_color="#5577AA"
        ).pack(expand=True)

        # Main content
        content = ctk.CTkFrame(self._root)
        content.pack(fill="both", expand=True, padx=10, pady=10)
        content.columnconfigure(0, weight=2)
        content.columnconfigure(1, weight=3)
        content.rowconfigure(0, weight=1)

        left = ctk.CTkFrame(content)
        left.grid(row=0, column=0, sticky="nsew", padx=(0, 5))
        self._build_left(left)

        right = ctk.CTkFrame(content)
        right.grid(row=0, column=1, sticky="nsew")
        self._build_right(right)

    def _build_left(self, parent):
        # Search
        ctk.CTkLabel(parent, text="Recherche article").pack(
            anchor="w", padx=10, pady=(10, 2))
        self._search_var = ctk.StringVar()
        self._search_var.trace_add("write", self._on_search_change)
        ctk.CTkEntry(parent, textvariable=self._search_var,
                     placeholder_text="Tapez un nom d'article…",
                     width=300).pack(fill="x", padx=10)

        self._suggest_frame = ctk.CTkFrame(
            parent, fg_color="#f0f0f0", corner_radius=4)
        self._suggest_frame.pack(fill="x", padx=10)

        # Results table
        self._table_frame = ctk.CTkScrollableFrame(
            parent, label_text="Résultats")
        self._table_frame.pack(fill="both", expand=True, padx=10, pady=(6, 4))

        # History section
        ctk.CTkLabel(parent, text="Historique",
                     font=("Helvetica", 12, "bold")).pack(
                         anchor="w", padx=10, pady=(4, 2))
        self._history_frame = ctk.CTkScrollableFrame(parent, height=160)
        self._history_frame.pack(fill="x", padx=10, pady=(0, 8))
        self._refresh_history()

    def _build_right(self, parent):
        ctk.CTkLabel(parent, text="Format",
                     font=("Helvetica", 14, "bold")).pack(
                         anchor="w", padx=10, pady=(10, 2))
        self._format_var = ctk.StringVar(value="label")
        fmt_row = ctk.CTkFrame(parent, fg_color="transparent")
        fmt_row.pack(fill="x", padx=10)
        ctk.CTkRadioButton(
            fmt_row, text="Étiquette Zebra",
            variable=self._format_var, value="label",
            command=self._refresh_preview).pack(side="left", padx=5)
        ctk.CTkRadioButton(
            fmt_row, text="Affiche A4",
            variable=self._format_var, value="a4",
            command=self._refresh_preview).pack(side="left", padx=20)

        self._preview_text = ctk.CTkTextbox(
            parent, height=260, font=("Courier", 12))
        self._preview_text.pack(fill="x", padx=10, pady=10)
        self._preview_text.configure(state="disabled")

        btn_frame = ctk.CTkFrame(parent, fg_color="transparent")
        btn_frame.pack(fill="x", padx=10, pady=5)
        ctk.CTkButton(btn_frame, text="🖨  Imprimer étiquette",
                      command=self._print_label).pack(side="left", padx=5)
        ctk.CTkButton(btn_frame, text="📄  Exporter PDF A4",
                      command=self._export_pdf).pack(side="left", padx=5)
        ctk.CTkButton(btn_frame, text="🖨  Imprimer A4",
                      command=self._print_a4).pack(side="left", padx=5)

    # ── Event handlers ───────────────────────────────────────────

    def _on_file_drop(self, event):
        # tkinterdnd2 wraps paths with braces on Windows if they contain spaces
        path = event.data.strip().strip("{}")
        if path.lower().endswith((".xlsx", ".xls")):
            self._load_excel(path)
        else:
            messagebox.showwarning(
                "Format non supporté",
                "Veuillez déposer un fichier Excel (.xlsx ou .xls).")

    def _browse_excel(self):
        path = filedialog.askopenfilename(
            title="Sélectionner le fichier Excel",
            filetypes=[("Excel files", "*.xlsx *.xls"), ("All files", "*.*")])
        if path:
            self._load_excel(path)

    def _load_excel(self, path: str):
        try:
            self._reader = ExcelReader(
                path,
                on_mapping_needed=self._ask_mapping)
            self._config.set("last_excel_path", path)
            self._config.save()
            self._file_label.configure(
                text=os.path.basename(path), text_color="green")
            self._dnd_banner.pack_forget()  # hide drop hint
            self._populate_table(self._reader.all_rows())
        except Exception as e:
            messagebox.showerror("Erreur", f"Impossible de charger :\n{e}")

    def _ask_mapping(self, headers, current_mapping):
        """Callback from ExcelReader when auto-mapping is incomplete."""
        dlg = MappingDialog(self._root, headers, current_mapping)
        self._root.wait_window(dlg)
        return dlg.result

    def _on_search_change(self, *_):
        query = self._search_var.get()
        self._clear_suggestions()
        if not self._reader:
            return
        if query:
            for name in self._reader.suggestions(query, limit=8):
                self._add_suggestion(name)
            results = self._reader.search(query)
        else:
            results = self._reader.all_rows()
        self._populate_table(results)

    def _add_suggestion(self, name: str):
        btn = ctk.CTkButton(
            self._suggest_frame, text=name, anchor="w",
            fg_color="white", text_color="black",
            hover_color="#e0e0e0",
            command=lambda n=name: self._pick_suggestion(n))
        btn.pack(fill="x", padx=2, pady=1)
        self._suggestion_btns.append(btn)

    def _clear_suggestions(self):
        for b in self._suggestion_btns:
            b.destroy()
        self._suggestion_btns.clear()

    def _pick_suggestion(self, name: str):
        self._search_var.set(name)
        self._clear_suggestions()

    def _populate_table(self, rows: list):
        for w in self._table_frame.winfo_children():
            w.destroy()
        if not rows:
            ctk.CTkLabel(self._table_frame, text="Aucun résultat.").pack()
            return
        # Header row
        hdr = ctk.CTkFrame(self._table_frame, fg_color="#d0d0d0")
        hdr.pack(fill="x", pady=1)
        for text, width in [("Article", 220), ("Pvente", 70),
                             ("PPHT", 60), ("PPTTC", 60)]:
            ctk.CTkLabel(hdr, text=text, width=width, anchor="w" if width > 70 else "e",
                         font=("Helvetica", 11, "bold")).pack(
                             side="left", padx=5 if width > 70 else 0)
        for row in rows:
            self._add_table_row(row)

    def _add_table_row(self, row: dict):
        fp = ExcelReader.format_price
        frame = ctk.CTkFrame(
            self._table_frame, fg_color="transparent", cursor="hand2")
        frame.pack(fill="x", pady=1)
        ctk.CTkLabel(frame, text=row.get("article", ""),
                     width=220, anchor="w").pack(side="left", padx=5)
        ctk.CTkLabel(frame, text=fp(row.get("pvente", 0)) + "€",
                     width=70, anchor="e").pack(side="left")
        ctk.CTkLabel(frame, text=fp(row.get("ppro_htva", 0)),
                     width=60, anchor="e").pack(side="left")
        ctk.CTkLabel(frame, text=fp(row.get("ppro", 0)),
                     width=60, anchor="e").pack(side="left")
        for widget in [frame] + frame.winfo_children():
            widget.bind("<Button-1>",
                        lambda e, r=row: self._select_product(r))

    def _select_product(self, product: dict):
        self._selected_product = product
        self._refresh_preview()

    def _refresh_preview(self):
        if not self._selected_product:
            return
        p   = self._selected_product
        fmt = self._format_var.get()
        fp  = ExcelReader.format_price
        if fmt == "label":
            size = self._config.get_label_size_info()
            text = (
                f"── ÉTIQUETTE {size['width_mm']}×{size['height_mm']}mm ──\n\n"
                f"  {p.get('article','')}\n\n"
                f"       {fp(p.get('pvente',0))}€\n\n"
                f"  PPHT {fp(p.get('ppro_htva',0))}"
                f"  PPTTC {fp(p.get('ppro',0))}\n"
            )
        else:
            text = (
                f"── AFFICHE A4 HORIZONTALE ──\n\n"
                f"[LOGO]  {p.get('article','')}\n\n"
                f"           {fp(p.get('pvente',0))}€\n\n"
                f"P/L: {p.get('p_l','')}              "
                f"Origine: {p.get('origine','')}\n"
                f"           PPHT {fp(p.get('ppro_htva',0))}"
                f"  PPTTC {fp(p.get('ppro',0))}\n"
            )
        self._preview_text.configure(state="normal")
        self._preview_text.delete("1.0", "end")
        self._preview_text.insert("1.0", text)
        self._preview_text.configure(state="disabled")

    def _refresh_history(self):
        for w in self._history_frame.winfo_children():
            w.destroy()
        entries = self._history.list()
        if not entries:
            ctk.CTkLabel(self._history_frame,
                         text="Aucun historique.", text_color="gray").pack()
            return
        for entry in entries[:20]:   # show last 20 in panel
            badge = "ÉTIQ" if entry.get("format") == "label" else "A4"
            badge_color = "#4488DD" if badge == "ÉTIQ" else "#44AA66"
            row = ctk.CTkFrame(
                self._history_frame, fg_color="transparent", cursor="hand2")
            row.pack(fill="x", pady=1)
            ctk.CTkLabel(row, text=badge, width=38,
                         fg_color=badge_color, text_color="white",
                         corner_radius=4, font=("Helvetica", 10, "bold")
                         ).pack(side="left", padx=(2, 4))
            ctk.CTkLabel(row, text=entry.get("article", ""),
                         anchor="w", width=180).pack(side="left")
            ctk.CTkLabel(row,
                         text=entry.get("timestamp", ""),
                         text_color="gray",
                         font=("Helvetica", 10)).pack(side="right", padx=4)
            for widget in [row] + row.winfo_children():
                widget.bind("<Button-1>",
                            lambda e, en=entry: self._select_from_history(en))

    def _select_from_history(self, entry: dict):
        self._selected_product = entry
        self._format_var.set(entry.get("format", "label"))
        self._refresh_preview()

    def _print_label(self):
        if not self._selected_product:
            messagebox.showwarning("Attention", "Sélectionnez d'abord un article.")
            return
        size = self._config.get_label_size_info()
        zpl  = ZplGenerator.generate(
            self._selected_product,
            width_mm=size["width_mm"],
            height_mm=size["height_mm"])
        try:
            if self._config.get("printer_type") == "network":
                ip = self._config.get("network_ip")
                if not ip:
                    messagebox.showerror("Erreur", "Aucune IP réseau configurée.")
                    return
                ZebraPrinter.print_network(zpl, host=ip)
            else:
                name = self._config.get("usb_printer")
                if not name:
                    messagebox.showerror("Erreur",
                                         "Aucune imprimante USB sélectionnée.")
                    return
                ZebraPrinter.print_usb(zpl, printer_name=name)
            self._history.add(self._selected_product, fmt="label")
            self._refresh_history()
            messagebox.showinfo("Succès", "Étiquette envoyée à l'imprimante.")
        except Exception as e:
            messagebox.showerror("Erreur impression", str(e))

    def _export_pdf(self):
        if not self._selected_product:
            messagebox.showwarning("Attention", "Sélectionnez d'abord un article.")
            return
        save_path = filedialog.asksaveasfilename(
            defaultextension=".pdf",
            filetypes=[("PDF", "*.pdf")],
            initialfile=f"{self._selected_product.get('article','')[:30]}.pdf")
        if not save_path:
            return
        logo = self._logo_path()
        try:
            PdfGenerator.generate_a4(self._selected_product, save_path, logo)
            self._history.add(self._selected_product, fmt="a4")
            self._refresh_history()
            messagebox.showinfo("PDF exporté", f"Fichier enregistré :\n{save_path}")
        except Exception as e:
            messagebox.showerror("Erreur PDF", str(e))

    def _print_a4(self):
        if not self._selected_product:
            messagebox.showwarning("Attention", "Sélectionnez d'abord un article.")
            return
        logo = self._logo_path()
        tmp  = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
        tmp.close()
        try:
            PdfGenerator.generate_a4(self._selected_product, tmp.name, logo)
            self._history.add(self._selected_product, fmt="a4")
            self._refresh_history()
            ZebraPrinter.open_pdf_and_print(tmp.name)
        except Exception as e:
            messagebox.showerror("Erreur impression A4", str(e))

    def _logo_path(self) -> str | None:
        p = os.path.join(self._base_dir, "assets", "logo.png")
        return p if os.path.exists(p) else None

    def _open_settings(self):
        SettingsDialog(self._root, self._config)

    def run(self):
        self._root.mainloop()
```

**Step 3: Manual verification checklist**

```bash
python app.py
```

- [ ] Logo shows in top bar
- [ ] Blue drag & drop hint banner visible on startup
- [ ] Drag `yves.xlsx` onto window → file loads, banner hides
- [ ] Click "Charger Excel" → file picker works
- [ ] Typing "red" shows suggestions dropdown; clicking one fills search
- [ ] Clicking a table row updates preview
- [ ] Toggle format → preview updates
- [ ] Print label → sent or error shown
- [ ] Export PDF → file saved
- [ ] After print, history panel updates
- [ ] Clicking history entry re-selects product + format
- [ ] Drop a non-Excel file → warning shown

**Step 4: Commit**

```bash
git add ui/
git commit -m "feat: main window with drag & drop, history panel, settings"
```

---

## Task 11: Run full test suite

**Step 1:**

```bash
pytest tests/ -v
```

Expected: all green. Fix any failures before continuing.

**Step 2: Commit fixes if needed**

```bash
git add -A && git commit -m "fix: test suite clean pass"
```

---

## Task 12: PyInstaller packaging

**Files:**
- Create: `build.bat`

**Step 1: Generate spec**

```bash
pyinstaller --onefile --windowed --name GoForPrice \
  --add-data "assets;assets" \
  --hidden-import win32print \
  --hidden-import win32api \
  --hidden-import tkinterdnd2 \
  app.py
```

**Step 2: Edit `GoForPrice.spec`** — verify `datas` includes:

```python
datas=[('assets', 'assets')],
```

**Step 3: Create `build.bat`**

```bat
@echo off
pyinstaller GoForPrice.spec --clean
echo.
echo Build complete: dist\GoForPrice.exe
pause
```

**Step 4: Build**

```bash
pyinstaller GoForPrice.spec --clean
```

Expected: `dist/GoForPrice.exe` (~35-55MB).

**Step 5: Smoke test the `.exe`**

- Copy to a fresh folder (no Python)
- Double-click → opens
- Drag `yves.xlsx` → loads
- Print / export → works

**Step 6: Commit**

```bash
git add GoForPrice.spec build.bat
git commit -m "feat: PyInstaller spec and build script"
```

---

## Task 13: Final smoke test

**Full end-to-end checklist:**

- [ ] Drag `yves.xlsx` onto window → 5 rows load, banner hides
- [ ] Search "red" → 2 rows, suggestions shown
- [ ] Click suggestion → row selected, preview updates
- [ ] Switch format → preview updates
- [ ] Open Paramètres → change label size, save → reflected in preview
- [ ] Print label → ZPL sent (or graceful error if no printer)
- [ ] Export PDF A4 → file saved and opens
- [ ] Print A4 → opens in default PDF viewer
- [ ] History shows last 3 prints with correct badges
- [ ] Click history entry → re-selects product + format
- [ ] Drop an `.xlsx` with different column names → mapping dialog appears
- [ ] Close and reopen → last file auto-loaded, history preserved

**Final commit:**

```bash
git add -A
git commit -m "feat: GoForPrice label printer — complete v1.0"
```

---

## File map

```
GoForPrize/
├── app.py
├── requirements.txt
├── requirements-dev.txt
├── GoForPrice.spec
├── build.bat
├── assets/
│   └── logo.png
├── src/
│   ├── __init__.py
│   ├── config_manager.py
│   ├── column_mapper.py
│   ├── excel_reader.py
│   ├── zpl_generator.py
│   ├── pdf_generator.py
│   ├── printer.py
│   └── history_manager.py
├── ui/
│   ├── __init__.py
│   ├── main_window.py
│   ├── settings_dialog.py
│   └── mapping_dialog.py
├── tests/
│   ├── __init__.py
│   ├── test_config_manager.py
│   ├── test_column_mapper.py
│   ├── test_excel_reader.py
│   ├── test_zpl_generator.py
│   ├── test_pdf_generator.py
│   ├── test_printer.py
│   └── test_history_manager.py
└── docs/plans/
    └── 2026-03-06-label-printer.md
```
