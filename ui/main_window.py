import os, sys, tempfile, time
import customtkinter as ctk
import tkinter as tk
from tkinter import filedialog, messagebox
from tkinterdnd2 import TkinterDnD, DND_FILES

from src.config_manager  import ConfigManager
from src.excel_reader    import ExcelReader
from src.pdf_generator   import PdfGenerator
from src.printer         import DymoPrinter
from src.history_manager import HistoryManager
from src.text_cleaner    import clean_article
from ui.settings_dialog  import SettingsDialog
from ui.mapping_dialog   import MappingDialog

# ── Brand palette ────────────────────────────────────────────────────
P       = "#E8451E"   # GoForPrice orange-red
P_DK    = "#C03A18"   # primary dark (hover)
NAVY    = "#1B2B3A"   # header background
NAV2    = "#2E445A"   # secondary nav buttons
BG      = "#EDEEF0"   # window background
SURFACE = "#FFFFFF"   # panel surface
BORDER  = "#D8DADF"   # dividers / borders
TEXT    = "#1B2B3A"   # primary text
MUTED   = "#717785"   # secondary text
ROW_ALT = "#F7F8FA"   # alternating table row
ROW_SEL = "#FFF0EC"   # selected row tint

ctk.set_appearance_mode("light")
ctk.set_default_color_theme("blue")


class MainWindow:
    def __init__(self, base_dir: str):
        self._base_dir = base_dir
        self._config   = ConfigManager(os.path.join(base_dir, "config.json"))
        self._history  = HistoryManager(os.path.join(base_dir, "history.json"))
        self._reader           = None
        self._selected_product = None
        self._selected_row     = None   # highlighted row frame
        self._selected_hist_row = None  # highlighted history row frame
        self._table_rows       = []     # list of (frame, product, orig_bg)
        self._check_vars       = []     # list of (BooleanVar, key) for visible rows
        self._selected_keys    = set()  # persistent selection across searches
        self._key_to_product   = {}     # key → product dict
        self._suggestion_btns  = []
        self._search_after_id  = None

        self._a4_bg_cache: dict = {}   # (dw, ah) -> Tkinter PhotoImage

        self._root = TkinterDnD.Tk()
        ctk.set_appearance_mode("light")
        self._root.title("GoForPrice — Impression étiquettes")
        self._root.geometry("1200x720")
        self._root.configure(bg=BG)

        self._build_ui()
        self._root.after(50, self._prewarm_fonts)   # load fonts before first click

        self._root.drop_target_register(DND_FILES)
        self._root.dnd_bind("<<Drop>>", self._on_file_drop)

        # macOS: bring window to front so first click is not swallowed
        if sys.platform == "darwin":
            self._root.after(150, self._macos_activate)

    def _macos_activate(self):
        try:
            import subprocess, os as _os
            subprocess.Popen([
                "osascript", "-e",
                f"tell application \"System Events\" to set frontmost of "
                f"first process whose unix id is {_os.getpid()} to true"
            ])
        except Exception:
            pass
        self._root.lift()
        self._root.focus_force()

        last = self._config.get("last_excel_path")
        if last and os.path.exists(last):
            self._load_excel(last)

    # ── UI construction ───────────────────────────────────────────────

    def _build_ui(self):
        # ── Header ───────────────────────────────────────────────────
        header = tk.Frame(self._root, bg=NAVY, height=64)
        header.pack(fill="x")
        header.pack_propagate(False)

        logo_path = os.path.join(self._base_dir, "assets", "logo.png")
        if os.path.exists(logo_path):
            from PIL import Image, ImageTk
            pil = Image.open(logo_path)
            w, h = pil.size
            dh = 44
            dw = round(w / h * dh)
            pil = pil.resize((dw, dh), Image.LANCZOS)
            photo = ImageTk.PhotoImage(pil)
            lbl = tk.Label(header, image=photo, text="", bg=NAVY)
            lbl._photo = photo   # prevent GC
            lbl.pack(side="left", padx=(12, 8), pady=10)
        else:
            tk.Label(header, text="GoForPrice",
                     font=("Helvetica", 18, "bold"),
                     bg=NAVY, fg="white").pack(side="left", padx=14)

        ctk.CTkButton(
            header, text="📂  Charger Excel",
            command=self._browse_excel,
            width=160, height=36,
            font=ctk.CTkFont("Helvetica", 13, weight="bold"),
            fg_color=P, hover_color=P_DK,
            text_color="white", corner_radius=8,
        ).pack(side="left", padx=(4, 10), pady=14)

        self._file_label = tk.Label(
            header,
            text="Glissez un fichier .xlsx ici ou cliquez Charger",
            font=("Helvetica", 12), bg=NAVY, fg="#8A9BB0")
        self._file_label.pack(side="left", padx=4)

        # "Changer" button — hidden until a file is loaded
        self._change_btn = ctk.CTkButton(
            header, text="↺  Changer",
            command=self._browse_excel,
            width=100, height=28,
            font=ctk.CTkFont("Helvetica", 11),
            fg_color="#2E445A", hover_color="#3E5470",
            text_color="#A0C4FF", corner_radius=6)
        # not packed yet — shown on first successful load

        ctk.CTkButton(
            header, text="⚙  Paramètres",
            command=self._open_settings,
            width=130, height=36,
            font=ctk.CTkFont("Helvetica", 13),
            fg_color=NAV2, hover_color="#3E5470",
            text_color="white", corner_radius=8,
        ).pack(side="right", padx=12, pady=14)

        # ── DnD banner ───────────────────────────────────────────────
        self._dnd_banner = tk.Frame(self._root, bg="#DDE8F8", height=34)
        self._dnd_banner.pack(fill="x")
        self._dnd_banner.pack_propagate(False)
        self._dnd_label = tk.Label(
            self._dnd_banner,
            text="⬇  Glissez votre fichier Excel n'importe où dans la fenêtre",
            font=("Helvetica", 11), bg="#DDE8F8", fg="#4466AA",
            cursor="hand2")
        self._dnd_label.pack(expand=True)
        self._dnd_label.bind("<Button-1>", lambda e: self._browse_excel())

        # ── Body ─────────────────────────────────────────────────────
        body = tk.Frame(self._root, bg=BG)
        body.pack(fill="both", expand=True, padx=10, pady=8)

        # Left panel (fixed width)
        left = tk.Frame(body, bg=SURFACE,
                        highlightthickness=1, highlightbackground=BORDER)
        left.pack(side="left", fill="y", padx=(0, 8))
        left.configure(width=420)
        left.pack_propagate(False)
        self._build_left(left)

        # Right panel (expands)
        right = tk.Frame(body, bg=SURFACE,
                         highlightthickness=1, highlightbackground=BORDER)
        right.pack(side="left", fill="both", expand=True)
        self._build_right(right)

    def _build_left(self, parent):
        # Search
        tk.Label(parent, text="Recherche article",
                 font=("Helvetica", 11, "bold"),
                 bg=SURFACE, fg=TEXT).pack(anchor="w", padx=12, pady=(12, 4))

        self._search_var = ctk.StringVar()
        self._search_var.trace_add("write", self._on_search_change)
        ctk.CTkEntry(
            parent,
            textvariable=self._search_var,
            placeholder_text="🔍  Tapez un nom d'article…",
            height=36, font=ctk.CTkFont("Helvetica", 12),
            corner_radius=8, border_width=1,
        ).pack(fill="x", padx=12)

        # Suggestion dropdown frame
        self._suggest_frame = tk.Frame(
            parent, bg="#FAFAFA",
            highlightthickness=1, highlightbackground=BORDER)
        self._suggest_frame.pack(fill="x", padx=12)

        # Column headers
        tk.Frame(parent, bg=BORDER, height=1).pack(fill="x", pady=(8, 0))
        hdr = tk.Frame(parent, bg="#F2F3F5")
        hdr.pack(fill="x")
        self._select_all_var = tk.BooleanVar(value=False)
        tk.Checkbutton(hdr, variable=self._select_all_var,
                       command=self._toggle_select_all,
                       bg="#F2F3F5", activebackground="#F2F3F5",
                       relief="flat", bd=0,
                       ).pack(side="left", padx=(4, 0))
        for text, width, anchor in [
            ("Article",  17, "w"),
            ("P/L",       5, "w"),
            ("Pvente",    8, "e"),
            ("PPHT",      7, "e"),
            ("PPTTC",     7, "e"),
        ]:
            tk.Label(hdr, text=text, width=width,
                     font=("Helvetica", 10, "bold"),
                     bg="#F2F3F5", fg=MUTED,
                     anchor=anchor, pady=5,
                     padx=6 if anchor == "w" else 2,
                     ).pack(side="left")
        tk.Frame(parent, bg=BORDER, height=1).pack(fill="x")

        # Scrollable product table
        tbl_wrap = tk.Frame(parent, bg=SURFACE)
        tbl_wrap.pack(fill="both", expand=True)

        self._table_canvas = tk.Canvas(
            tbl_wrap, bg=SURFACE, highlightthickness=0, bd=0)
        tbl_sb = tk.Scrollbar(
            tbl_wrap, orient="vertical",
            command=self._table_canvas.yview)
        self._table_frame = tk.Frame(self._table_canvas, bg=SURFACE)
        self._table_frame.bind(
            "<Configure>",
            lambda e: self._table_canvas.configure(
                scrollregion=self._table_canvas.bbox("all")))
        self._tbl_win = self._table_canvas.create_window(
            (0, 0), window=self._table_frame, anchor="nw")
        self._table_canvas.configure(yscrollcommand=tbl_sb.set)
        self._table_canvas.bind(
            "<Configure>",
            lambda e: self._table_canvas.itemconfigure(
                self._tbl_win, width=e.width))
        self._table_canvas.bind("<MouseWheel>", self._on_mousewheel)
        self._table_frame.bind("<MouseWheel>", self._on_mousewheel)
        self._table_canvas.pack(side="left", fill="both", expand=True)
        tbl_sb.pack(side="right", fill="y")

        # Separator + History
        tk.Frame(parent, bg=BORDER, height=1).pack(fill="x")
        tk.Label(parent, text="Historique",
                 font=("Helvetica", 11, "bold"),
                 bg=SURFACE, fg=TEXT).pack(anchor="w", padx=12, pady=(8, 4))

        hist_wrap = tk.Frame(parent, bg=SURFACE, height=165)
        hist_wrap.pack(fill="x", pady=(0, 8))
        hist_wrap.pack_propagate(False)

        self._hist_canvas = tk.Canvas(
            hist_wrap, bg=SURFACE, highlightthickness=0)
        self._hist_canvas.pack(fill="both", expand=True, padx=12)

        self._history_frame = tk.Frame(self._hist_canvas, bg=SURFACE)
        self._hist_canvas.create_window(
            (0, 0), window=self._history_frame, anchor="nw")
        self._history_frame.bind(
            "<Configure>",
            lambda e: self._hist_canvas.configure(
                scrollregion=self._hist_canvas.bbox("all")))

        self._refresh_history()

    def _on_mousewheel(self, event):
        self._table_canvas.yview_scroll(
            int(-1 * (event.delta / 120)), "units")

    def _build_right(self, parent):
        # Format label
        tk.Label(parent, text="Format d'impression",
                 font=("Helvetica", 12, "bold"),
                 bg=SURFACE, fg=TEXT).pack(anchor="w", padx=16, pady=(14, 8))

        # Format toggle — custom segmented buttons
        fmt_row = tk.Frame(parent, bg=SURFACE)
        fmt_row.pack(fill="x", padx=16, pady=(0, 12))
        self._format_var = ctk.StringVar(value="label")

        self._btn_label_fmt = ctk.CTkButton(
            fmt_row, text="🏷  Étiquette Dymo",
            command=lambda: self._set_format("label"),
            width=164, height=34,
            font=ctk.CTkFont("Helvetica", 12, weight="bold"),
            fg_color=P, hover_color=P_DK,
            text_color="white", corner_radius=6)
        self._btn_label_fmt.pack(side="left", padx=(0, 4))

        self._btn_a4_fmt = ctk.CTkButton(
            fmt_row, text="📄  Affiche A4",
            command=lambda: self._set_format("a4"),
            width=130, height=34,
            font=ctk.CTkFont("Helvetica", 12),
            fg_color="#E2E4E8", hover_color=BORDER,
            text_color=TEXT, corner_radius=6)
        self._btn_a4_fmt.pack(side="left")

        # Preview area — fixed-size canvas avoids layout recalculation on every render
        preview_bg = tk.Frame(parent, bg="#EDEEF2")
        preview_bg.pack(fill="both", expand=True, padx=16, pady=(0, 12))

        self._preview_canvas = tk.Canvas(
            preview_bg, bg="#EDEEF2", highlightthickness=0,
            width=500, height=360)
        self._preview_canvas.pack(expand=True)   # size is fixed — pack just centers it

        self._placeholder = tk.Label(
            preview_bg,
            text="← Sélectionnez un article\npour voir l'aperçu",
            font=("Helvetica", 13), bg="#EDEEF2",
            fg=MUTED, justify="center")
        self._placeholder.place(relx=0.5, rely=0.5, anchor="center")

        # Action buttons
        btn_bar = tk.Frame(parent, bg=SURFACE)
        btn_bar.pack(fill="x", padx=16, pady=(0, 14))

        ctk.CTkButton(
            btn_bar, text="🖨  Imprimer étiquette",
            command=self._print_label,
            width=190, height=42,
            font=ctk.CTkFont("Helvetica", 13, weight="bold"),
            fg_color=P, hover_color=P_DK,
            corner_radius=8,
        ).pack(side="left", padx=(0, 6))

        ctk.CTkButton(
            btn_bar, text="📄  Exporter PDF A4",
            command=self._export_pdf,
            width=160, height=42,
            font=ctk.CTkFont("Helvetica", 13),
            fg_color=NAV2, hover_color="#3E5470",
            corner_radius=8,
        ).pack(side="left", padx=(0, 6))

        ctk.CTkButton(
            btn_bar, text="🖨  Imprimer A4",
            command=self._print_a4,
            width=140, height=42,
            font=ctk.CTkFont("Helvetica", 13),
            fg_color=NAV2, hover_color="#3E5470",
            corner_radius=8,
        ).pack(side="left")

        # Batch action row (uses checkboxes in the article list)
        batch_bar = tk.Frame(parent, bg=SURFACE)
        batch_bar.pack(fill="x", padx=16, pady=(0, 14))
        ctk.CTkButton(
            batch_bar, text="☑  Étiquettes (sélection)",
            command=self._batch_print_labels,
            width=210, height=36,
            font=ctk.CTkFont("Helvetica", 12),
            fg_color=P, hover_color=P_DK,
            corner_radius=8,
        ).pack(side="left", padx=(0, 6))
        ctk.CTkButton(
            batch_bar, text="☑  Imprimer A4 (sélection)",
            command=self._batch_print_a4,
            width=210, height=36,
            font=ctk.CTkFont("Helvetica", 12),
            fg_color=NAV2, hover_color="#3E5470",
            corner_radius=8,
        ).pack(side="left", padx=(0, 6))
        ctk.CTkButton(
            batch_bar, text="✕  Décocher tout",
            command=self._unselect_all,
            width=140, height=36,
            font=ctk.CTkFont("Helvetica", 12),
            fg_color="#888", hover_color="#666",
            corner_radius=8,
        ).pack(side="left")

    def _set_format(self, fmt: str):
        self._format_var.set(fmt)
        if fmt == "label":
            self._btn_label_fmt.configure(fg_color=P, text_color="white")
            self._btn_a4_fmt.configure(fg_color="#E2E4E8", text_color=TEXT)
        else:
            self._btn_a4_fmt.configure(fg_color=P, text_color="white")
            self._btn_label_fmt.configure(fg_color="#E2E4E8", text_color=TEXT)
        self._refresh_preview()

    # ── File loading ──────────────────────────────────────────────────

    def _on_file_drop(self, event):
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
                path, on_mapping_needed=self._ask_mapping)
            self._config.set("last_excel_path", path)
            self._config.save()
            name = os.path.basename(path)
            self._file_label.configure(text=f"✓  {name}", fg="#7EC8A0")
            # Show "Changer" button in header
            self._change_btn.pack(side="left", padx=(2, 0), pady=18)
            # Transform banner into a subtle "replace file" drop zone
            self._dnd_banner.configure(bg="#F0F4E8")
            self._dnd_label.configure(
                text=f"↕  Glisser un nouveau fichier ici pour remplacer  {name}",
                bg="#F0F4E8", fg="#5A7A30")
            self._populate_table(self._reader.all_rows())
            # Auto-select first row so preview is visible immediately
            if self._table_rows:
                fr, first_row, _ = self._table_rows[0]
                self._select_product(first_row, fr)
        except Exception as e:
            messagebox.showerror("Erreur", f"Impossible de charger :\n{e}")

    def _ask_mapping(self, headers, current_mapping):
        dlg = MappingDialog(self._root, headers, current_mapping)
        self._root.wait_window(dlg)
        self._root.focus_force()
        return dlg.result

    # ── Search ────────────────────────────────────────────────────────

    def _on_search_change(self, *_):
        if self._search_after_id:
            self._root.after_cancel(self._search_after_id)
        self._search_after_id = self._root.after(150, self._do_search)

    def _do_search(self):
        self._search_after_id = None
        query = self._search_var.get()
        self._clear_suggestions()
        if not self._reader:
            return
        if query:
            suggestions, results = self._reader.search_with_suggestions(query, limit=8)
            for name in suggestions:
                self._add_suggestion(name)
        else:
            results = self._reader.all_rows()
        self._populate_table(results)

    def _add_suggestion(self, name: str):
        btn = tk.Button(
            self._suggest_frame, text=name,
            anchor="w", relief="flat",
            font=("Helvetica", 11), bg="#FAFAFA", fg=TEXT,
            activebackground=ROW_ALT, cursor="hand2", pady=3,
            command=lambda n=name: self._pick_suggestion(n))
        btn.pack(fill="x", padx=4)
        self._suggestion_btns.append(btn)

    def _clear_suggestions(self):
        for b in self._suggestion_btns:
            b.destroy()
        self._suggestion_btns.clear()

    def _pick_suggestion(self, name: str):
        self._search_var.set(name)
        self._clear_suggestions()

    # ── Table ─────────────────────────────────────────────────────────

    _MAX_ROWS = 5000

    def _populate_table(self, rows: list):
        for w in self._table_frame.winfo_children():
            w.destroy()
        self._table_rows.clear()
        self._check_vars.clear()
        self._selected_row = None
        if not rows:
            tk.Label(self._table_frame, text="Aucun résultat.",
                     font=("Helvetica", 12), bg=SURFACE,
                     fg=MUTED, pady=20).pack()
            return
        total = len(rows)
        for i, row in enumerate(rows[:self._MAX_ROWS]):
            self._add_table_row(row, i)
        if total > self._MAX_ROWS:
            tk.Label(self._table_frame,
                     text=f"… {total - self._MAX_ROWS} autres (affinez la recherche)",
                     font=("Helvetica", 9), bg=SURFACE,
                     fg=MUTED, pady=4).pack()

    def _add_table_row(self, row: dict, idx: int = 0):
        fp  = ExcelReader.format_price
        bg  = SURFACE if idx % 2 == 0 else ROW_ALT
        fr  = tk.Frame(self._table_frame, bg=bg, cursor="hand2")
        fr.pack(fill="x")

        key = (row.get("article", ""), str(row.get("pvente", 0)), idx)
        self._key_to_product[key] = row
        var = tk.BooleanVar(value=(key in self._selected_keys))
        self._check_vars.append((var, key))
        cb = tk.Checkbutton(fr, variable=var, bg=bg, activebackground=bg,
                            relief="flat", bd=0,
                            command=self._make_check_cmd(var, key))
        cb.pack(side="left", padx=(4, 0))

        tk.Label(fr, text=row.get("article", ""),
                 width=17, anchor="w",
                 font=("Helvetica", 11), bg=bg, fg=TEXT,
                 padx=8, pady=5).pack(side="left")
        tk.Label(fr, text=ExcelReader.format_price_per_litre(row.get("p_l", "") or ""),
                 width=8, anchor="w",
                 font=("Helvetica", 10), bg=bg, fg=MUTED,
                 pady=5).pack(side="left")
        tk.Label(fr, text=fp(row.get("pvente", 0)) + "€",
                 width=8, anchor="e",
                 font=("Helvetica", 11, "bold"),
                 bg=bg, fg=P, pady=5).pack(side="left")
        tk.Label(fr, text=fp(row.get("ppro_htva", 0)),
                 width=7, anchor="e",
                 font=("Helvetica", 11), bg=bg, fg=MUTED,
                 pady=5).pack(side="left")
        tk.Label(fr, text=fp(row.get("ppro", 0)),
                 width=7, anchor="e",
                 font=("Helvetica", 11), bg=bg, fg=MUTED,
                 pady=5).pack(side="left")

        fr._orig_bg = bg   # stored for O(1) deselect
        self._table_rows.append((fr, row, bg))

        for w in [fr] + [c for c in fr.winfo_children()
                         if not isinstance(c, tk.Checkbutton)]:
            w.bind("<Button-1>",
                   lambda e, r=row, f=fr: self._select_product(r, f))

    def _set_row_bg(self, frame, bg):
        # Skip no-op: avoid configure calls when colour hasn't changed
        if getattr(frame, '_current_bg', None) == bg:
            return
        frame._current_bg = bg
        try:
            frame.configure(bg=bg)
        except Exception:
            pass
        for child in frame.winfo_children():
            try:
                child.configure(bg=bg)
            except Exception:
                pass

    def _select_product(self, product: dict, row_frame=None):
        # Deselect previous history row
        if self._selected_hist_row:
            prev = self._selected_hist_row
            for lbl in getattr(prev, "_text_labels", []):
                try:
                    lbl.configure(bg=SURFACE)
                except Exception:
                    pass
            try:
                prev.configure(bg=SURFACE)
            except Exception:
                pass
            self._selected_hist_row = None
        # Deselect previous table row — O(1) via stored attribute
        if self._selected_row:
            self._set_row_bg(self._selected_row,
                             getattr(self._selected_row, "_orig_bg", SURFACE))
        self._selected_product = product
        self._selected_row = row_frame
        # Highlight selected row
        if row_frame:
            self._set_row_bg(row_frame, ROW_SEL)
        # Show preview
        self._placeholder.place_forget()
        self._refresh_preview()

    # ── Preview ───────────────────────────────────────────────────────

    # Fixed canvas dimensions — NEVER call c.configure(width/height) after init.
    # Changing canvas size triggers a full pack-geometry recalculation which is
    # the main source of the perceived delay. Draw centered within fixed bounds.
    _PREV_W = 500
    _PREV_H = 360
    _DRAW_W = 460   # drawing area (20 px margin each side)

    def _get_a4_bg_image(self, dw: int, ah: int):
        """Render the A4 layout PDF to a Tkinter PhotoImage scaled to dw×ah.

        Result is cached so the PDF is only decoded once per canvas size.
        Returns None if PyMuPDF is unavailable or the file is missing.
        """
        key = (dw, ah)
        if key in self._a4_bg_cache:
            return self._a4_bg_cache[key]
        layout_path = os.path.join(self._base_dir, "assets", "a4layout_bg.pdf")
        photo = None
        if os.path.exists(layout_path):
            try:
                import fitz  # PyMuPDF
                from PIL import Image, ImageTk
                doc  = fitz.open(layout_path)
                page = doc[0]
                mat  = fitz.Matrix(dw / page.rect.width, ah / page.rect.height)
                pix  = page.get_pixmap(matrix=mat)
                img  = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                doc.close()
                photo = ImageTk.PhotoImage(img)
            except Exception:
                pass
        self._a4_bg_cache[key] = photo
        return photo

    def _prewarm_fonts(self):
        """Force Tkinter to load Arial at all actual preview sizes before first click."""
        RATIO = 1.61
        DW    = self._DRAW_W

        # Label (Dymo 89×36) sizes
        lh      = round(DW * 36 / 89)
        f_pro_l = max(9, round(lh * 0.085))
        sizes_l = {f_pro_l, round(f_pro_l * RATIO), round(round(f_pro_l * RATIO) * RATIO)}

        # A4 landscape sizes
        ah      = round(DW * 210 / 297)
        f_pro_a = max(9, round(ah * 0.065))
        sizes_a = {f_pro_a, round(f_pro_a * RATIO), round(round(f_pro_a * RATIO) * RATIO)}

        c = self._preview_canvas
        for size in sizes_l | sizes_a:
            c.create_text(-999, -999, text=".", font=("Arial", size), anchor="nw")
            c.create_text(-999, -999, text=".", font=("Arial", size, "bold"), anchor="nw")
        c.update_idletasks()
        c.delete("all")

    def _refresh_preview(self):
        if not self._selected_product:
            return
        p  = self._selected_product
        fp = ExcelReader.format_price
        c  = self._preview_canvas
        c.delete("all")

        RATIO  = 1.61
        PW     = self._PREV_W   # 500
        PH     = self._PREV_H   # 360
        DW     = self._DRAW_W   # 460

        # Grey background fill (canvas bg is already #EDEEF2 but items cover it)
        c.create_rectangle(0, 0, PW, PH, fill="#EDEEF2", outline="")

        if self._format_var.get() == "label":
            size = self._config.get_label_size_info()
            lh   = round(DW * size["height_mm"] / size["width_mm"])
            x0   = (PW - DW) // 2
            y0   = max(16, (PH - lh) // 2)

            m       = round(lh * 0.10)
            f_pro   = max(9,  round(lh * 0.085))
            f_title = round(f_pro   * RATIO)
            f_price = round(f_title * RATIO)

            c.create_rectangle(x0+3, y0+3, x0+DW+3, y0+lh+3,
                                fill="#C8C8C8", outline="")
            c.create_rectangle(x0, y0, x0+DW, y0+lh,
                                fill="white", outline="#BBBBBB", width=1)
            art_id = c.create_text(x0 + DW//2, y0+m,
                          text=clean_article(p.get("article", "")),
                          font=("Arial", f_title, "bold"),
                          anchor="n", fill="black", width=DW - 2*m,
                          justify="center")
            # Price at vertical centre of card (matches PDF layout)
            price_y = y0 + lh // 2
            # Clamp: don't overlap article text above
            art_bbox = c.bbox(art_id)
            art_bottom = art_bbox[3] if art_bbox else y0 + m + f_title * 2
            if price_y - f_price // 2 < art_bottom + 2:
                price_y = art_bottom + f_price // 2 + 2
            c.create_text(x0 + DW//2, price_y,
                          text=f"{fp(p.get('pvente', 0))}€",
                          font=("Arial", f_price, "bold"),
                          anchor="center", fill="black")
            c.create_text(x0+DW-m, y0+lh-m,
                          text=(f"PPHT {fp(p.get('ppro_htva', 0))}"
                                f"   PPTTC {fp(p.get('ppro', 0))}"),
                          font=("Arial", f_pro), anchor="se", fill="black")

        else:  # A4 landscape — preview mirrors the pre-printed layout
            ah   = round(DW * 210 / 297)
            x0   = (PW - DW) // 2
            y0   = max(8, (PH - ah) // 2)

            m       = round(ah * 0.06)
            f_pro   = max(9,  round(ah * 0.04))
            f_title = round(f_pro   * RATIO * 1.2)
            f_price = round(f_pro   * RATIO * RATIO)

            # Drop-shadow + fallback white card (visible if PDF bg fails to load)
            c.create_rectangle(x0+3, y0+3, x0+DW+3, y0+ah+3,
                                fill="#C8C8C8", outline="")
            c.create_rectangle(x0, y0, x0+DW, y0+ah,
                                fill="white", outline="#BBBBBB", width=1)

            # Background: render the pre-printed A4 layout PDF
            bg = self._get_a4_bg_image(DW, ah)
            if bg:
                c.create_image(x0, y0, image=bg, anchor="nw")

            # ── Safe-zone geometry (header = 90 mm / 210 mm of page height) ──
            HEADER_FRAC = PdfGenerator.A4_HEADER_MM / 210
            header_px   = round(ah * HEADER_FRAC)   # pixel height of header zone
            safe_top    = y0 + header_px             # canvas-y of top of text zone
            safe_h      = ah - header_px             # text zone height in pixels

            # All text mirrors the PDF output: black only
            # Article — just below header line, centred
            c.create_text(x0 + DW // 2,
                          safe_top + round(safe_h * 0.02),
                          text=clean_article(p.get("article", "")),
                          font=("Arial", f_title, "bold"),
                          anchor="center", fill="black",
                          width=DW - 2 * m, justify="center")

            # Price — centred in safe zone
            c.create_text(x0 + DW // 2,
                          safe_top + round(safe_h * 0.46),
                          text=f"{fp(p.get('pvente', 0))}€",
                          font=("Arial", f_price, "bold"),
                          anchor="center", fill="black")

            # Price per litre — bottom-left (value only, no label)
            if p.get("p_l"):
                c.create_text(x0 + m,
                              safe_top + round(safe_h * 0.72),
                              text=ExcelReader.format_price_per_litre(p.get("p_l", "")),
                              font=("Arial", f_pro), anchor="w", fill="black")

            # Origine — bottom-right
            if p.get("origine"):
                c.create_text(x0 + DW - m,
                              safe_top + round(safe_h * 0.72),
                              text=f"Origine : {p.get('origine', '')}",
                              font=("Arial", f_pro), anchor="e", fill="black")

            # PPHT / PPTTC — very bottom, right (same size as Origine)
            f_ppro = f_pro
            c.create_text(x0 + DW - m,
                          safe_top + round(safe_h * 0.85),
                          text=(f"PPHT {fp(p.get('ppro_htva', 0))}"
                                f"   PPTTC {fp(p.get('ppro', 0))}"),
                          font=("Arial", f_ppro), anchor="e", fill="#444444")

    # ── History ───────────────────────────────────────────────────────

    def _refresh_history(self):
        for w in self._history_frame.winfo_children():
            w.destroy()
        entries = self._history.list()
        if not entries:
            tk.Label(self._history_frame, text="Aucun historique.",
                     font=("Helvetica", 11), bg=SURFACE,
                     fg=MUTED).pack(pady=6)
            return
        for entry in entries[:20]:
            badge = "ÉTIQ" if entry.get("format") == "label" else "A4"
            bc    = P if badge == "ÉTIQ" else "#16A34A"
            row   = tk.Frame(self._history_frame, bg=SURFACE, cursor="hand2")
            row.pack(fill="x", pady=1)
            tk.Label(row, text=badge, width=5,
                     font=("Helvetica", 9, "bold"),
                     bg=bc, fg="white", pady=2,
                     ).pack(side="left", padx=(0, 6))
            art_lbl = tk.Label(row, text=entry.get("article", ""),
                     font=("Helvetica", 11), bg=SURFACE, fg=TEXT,
                     anchor="w", width=22)
            art_lbl.pack(side="left")
            ts_lbl = tk.Label(row, text=entry.get("timestamp", ""),
                     font=("Helvetica", 9), bg=SURFACE, fg=MUTED)
            ts_lbl.pack(side="right", padx=4)
            row._text_labels = [art_lbl, ts_lbl]
            for w in [row, art_lbl, ts_lbl]:
                w.bind("<Button-1>",
                       lambda e, en=entry, f=row: self._select_from_history(en, f))

    def _select_from_history(self, entry: dict, row_frame=None):
        # Deselect active table row
        if self._selected_row:
            self._set_row_bg(self._selected_row,
                             getattr(self._selected_row, "_orig_bg", SURFACE))
            self._selected_row = None
        # Deselect previous history row
        if self._selected_hist_row:
            prev = self._selected_hist_row
            for lbl in getattr(prev, "_text_labels", []):
                try:
                    lbl.configure(bg=SURFACE)
                except Exception:
                    pass
            try:
                prev.configure(bg=SURFACE)
            except Exception:
                pass
        # Highlight new history row
        self._selected_hist_row = row_frame
        if row_frame:
            for lbl in getattr(row_frame, "_text_labels", []):
                try:
                    lbl.configure(bg=ROW_SEL)
                except Exception:
                    pass
            try:
                row_frame.configure(bg=ROW_SEL)
            except Exception:
                pass
        self._selected_product = entry
        self._placeholder.place_forget()
        self._set_format(entry.get("format", "label"))

    # ── Print / Export ────────────────────────────────────────────────

    def _print_label(self):
        if not self._selected_product:
            messagebox.showwarning("Attention", "Sélectionnez d'abord un article.")
            return
        name = self._config.get("usb_printer")
        if not name or name == "(aucune)":
            # Auto-detect: prefer Dymo/Label printer, else first available
            available = [p for p in DymoPrinter.list_dymo_printers()
                         if p and p != "(aucune)"]
            if not available:
                messagebox.showerror("Erreur",
                    "Aucune imprimante trouvée.\n"
                    "Vérifiez que l'imprimante est branchée et allumée.")
                return
            dymo = [p for p in available
                    if "dymo" in p.lower() or "label" in p.lower()]
            name = dymo[0] if dymo else available[0]
            self._config.set("usb_printer", name)
            self._config.save()
        size = self._config.get_label_size_info()
        logo = self._logo_path()
        tmp_path = os.path.join(tempfile.gettempdir(), "gofp_label.pdf")
        try:
            PdfGenerator.generate_label(
                self._selected_product, tmp_path, logo,
                width_mm=size["width_mm"],
                height_mm=size["height_mm"])
            DymoPrinter.print_label_pdf(tmp_path, printer_name=name)
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
        tmp_path = os.path.join(tempfile.gettempdir(), f"gofp_a4_{int(time.time())}.pdf")
        try:
            PdfGenerator.generate_a4(self._selected_product, tmp_path, logo)
            self._history.add(self._selected_product, fmt="a4")
            self._refresh_history()
            DymoPrinter.open_pdf_and_print(tmp_path)
        except Exception as e:
            messagebox.showerror("Erreur impression A4", str(e))

    def _logo_path(self):
        p = os.path.join(self._base_dir, "assets", "logo.png")
        return p if os.path.exists(p) else None

    # ── Batch selection helpers ────────────────────────────────────────

    @staticmethod
    def _row_key(row):
        return (row.get("article", ""), str(row.get("pvente", 0)))

    def _make_check_cmd(self, var, key):
        def _cmd():
            if var.get():
                self._selected_keys.add(key)
            else:
                self._selected_keys.discard(key)
        return _cmd

    def _toggle_select_all(self):
        val = self._select_all_var.get()
        for var, key in self._check_vars:
            var.set(val)
            if val:
                self._selected_keys.add(key)
            else:
                self._selected_keys.discard(key)

    def _unselect_all(self):
        self._selected_keys.clear()
        self._select_all_var.set(False)
        for var, _ in self._check_vars:
            var.set(False)

    def _get_checked_products(self):
        return [self._key_to_product[k]
                for k in self._selected_keys
                if k in self._key_to_product]

    def _batch_print_labels(self):
        products = self._get_checked_products()
        if not products:
            messagebox.showwarning("Attention", "Cochez au moins un article.")
            return
        name = self._config.get("usb_printer")
        if not name or name == "(aucune)":
            available = [p for p in DymoPrinter.list_dymo_printers()
                         if p and p != "(aucune)"]
            if not available:
                messagebox.showerror("Erreur",
                    "Aucune imprimante trouvée.\n"
                    "Vérifiez que l'imprimante est branchée et allumée.")
                return
            dymo = [p for p in available
                    if "dymo" in p.lower() or "label" in p.lower()]
            name = dymo[0] if dymo else available[0]
            self._config.set("usb_printer", name)
            self._config.save()
        size = self._config.get_label_size_info()
        logo = self._logo_path()
        errors = []
        for i, product in enumerate(products):
            try:
                tmp = os.path.join(tempfile.gettempdir(), f"gofp_label_batch_{i}.pdf")
                PdfGenerator.generate_label(
                    product, tmp, logo,
                    width_mm=size["width_mm"],
                    height_mm=size["height_mm"])
                DymoPrinter.print_label_pdf(tmp, printer_name=name)
                self._history.add(product, fmt="label")
            except Exception as e:
                errors.append(f"{product.get('article', '?')}: {e}")
        self._refresh_history()
        if errors:
            messagebox.showerror("Erreurs", "\n".join(errors))
        else:
            messagebox.showinfo("Succès",
                f"{len(products)} étiquette(s) envoyée(s) à l'imprimante.")

    def _batch_print_a4(self):
        products = self._get_checked_products()
        if not products:
            messagebox.showwarning("Attention", "Cochez au moins un article.")
            return
        logo = self._logo_path()
        try:
            import fitz
            merger = fitz.open()
            for product in products:
                tmp = os.path.join(tempfile.gettempdir(),
                                   f"gofp_a4_{abs(hash(product.get('article','')))}.pdf")
                PdfGenerator.generate_a4(product, tmp, logo)
                src = fitz.open(tmp)
                merger.insert_pdf(src)
                src.close()
                self._history.add(product, fmt="a4")
            merged_path = os.path.join(tempfile.gettempdir(), "gofp_a4_batch.pdf")
            merger.save(merged_path)
            merger.close()
            self._refresh_history()
            DymoPrinter.open_pdf_and_print(merged_path)
        except Exception as e:
            messagebox.showerror("Erreur impression A4", str(e))

    def _open_settings(self):
        dlg = SettingsDialog(self._root, self._config)
        self._root.wait_window(dlg)
        self._root.focus_force()

    def run(self):
        self._root.mainloop()
