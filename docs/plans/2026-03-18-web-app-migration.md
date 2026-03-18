# GoForPrice Web App Migration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert the GoForPrice desktop Python app (CustomTkinter + PyInstaller) into a static PWA web app deployable on Cloudflare Pages, with a local print server for Dymo label printing.

**Architecture:** Pure client-side React SPA — all Excel parsing (SheetJS), PDF generation (pdf-lib), search, and preview happen in the browser. A tiny local print server (~50 lines Node.js) on a mini-PC next to the Dymo handles label printing over local WiFi. Settings stored in localStorage. PWA with offline support via Service Worker.

**Tech Stack:** React 18 + Vite + Tailwind CSS v4, SheetJS (xlsx), pdf-lib, Fuse.js, vite-plugin-pwa, Cloudflare Pages

---

## Phase 0: Project Scaffold

### Task 0.1: Initialize Vite + React + Tailwind project

**Files:**
- Create: `web/package.json`
- Create: `web/vite.config.js`
- Create: `web/index.html`
- Create: `web/src/main.jsx`
- Create: `web/src/App.jsx`
- Create: `web/src/index.css`
- Create: `web/public/favicon.svg`

**Step 1: Scaffold the project**

```bash
cd /Users/pc/GoForPrize
npm create vite@latest web -- --template react
cd web
npm install
npm install -D tailwindcss @tailwindcss/vite
npm install xlsx pdf-lib fuse.js
```

**Step 2: Configure Vite with Tailwind**

Replace `web/vite.config.js`:

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

Replace `web/src/index.css`:

```css
@import "tailwindcss";

:root {
  --p: #E8451E;
  --p-dk: #C03A18;
  --navy: #1B2B3A;
  --nav2: #2E445A;
  --bg: #EDEEF0;
  --surface: #FFFFFF;
  --border: #D8DADF;
  --text: #1B2B3A;
  --muted: #717785;
  --row-alt: #F7F8FA;
  --row-sel: #FFF0EC;
}
```

**Step 3: Verify dev server runs**

```bash
cd /Users/pc/GoForPrize/web && npm run dev
```
Expected: Vite dev server at http://localhost:5173

**Step 4: Commit**

```bash
git add web/
git commit -m "feat(web): scaffold Vite + React + Tailwind project with dependencies"
```

### Task 0.2: Copy static assets

**Files:**
- Copy: `assets/a4layout_bg.pdf` to `web/public/a4layout_bg.pdf`
- Copy: `assets/logo.png` to `web/public/logo.png`

**Step 1: Copy assets**

```bash
cp /Users/pc/GoForPrize/assets/a4layout_bg.pdf /Users/pc/GoForPrize/web/public/
cp /Users/pc/GoForPrize/assets/logo.png /Users/pc/GoForPrize/web/public/
```

**Step 2: Commit**

```bash
git add web/public/
git commit -m "feat(web): add static assets (logo, A4 layout background)"
```

---

## Phase 1: Data Layer (Pure Logic — No UI)

### Task 1.1: Port text_cleaner.js

**Files:**
- Create: `web/src/lib/textCleaner.js`
- Create: `web/src/lib/__tests__/textCleaner.test.js`

**Step 1: Write the failing test**

```javascript
// web/src/lib/__tests__/textCleaner.test.js
import { describe, it, expect } from 'vitest';
import { cleanArticle } from '../textCleaner';

describe('cleanArticle', () => {
  it('returns empty string for empty input', () => {
    expect(cleanArticle('')).toBe('');
    expect(cleanArticle(null)).toBe('');
  });
  it('collapses multiple spaces', () => {
    expect(cleanArticle('hello   world')).toBe('hello world');
  });
  it('inserts space at letter-digit boundary', () => {
    expect(cleanArticle('bouteille1x')).toBe('bouteille 1x');
  });
  it('corrects Red Bull misspellings', () => {
    expect(cleanArticle('redbull 250ml')).toBe('Red Bull 250ml');
    expect(cleanArticle('red bul canette')).toBe('Red Bull canette');
  });
  it('corrects Coca-Cola misspellings', () => {
    expect(cleanArticle('cocacola 1L')).toBe('Coca-Cola 1L');
  });
  it('corrects Heineken misspellings', () => {
    expect(cleanArticle('heiniken 33cl')).toBe('Heineken 33cl');
  });
  it('does not partial-match inside correct spelling', () => {
    expect(cleanArticle('Red Bull 250ml')).toBe('Red Bull 250ml');
  });
  it('is case-insensitive', () => {
    expect(cleanArticle('REDBULL 250ML')).toBe('Red Bull 250ML');
  });
  it('handles combined normalization + correction', () => {
    expect(cleanArticle('  redbull250ml  ')).toBe('Red Bull 250ml');
  });
});
```

**Step 2: Install vitest, run test to verify failure**

```bash
cd /Users/pc/GoForPrize/web && npm install -D vitest && npx vitest run src/lib/__tests__/textCleaner.test.js
```

**Step 3: Write implementation**

Port from `src/text_cleaner.py` — same CORRECTIONS dict (all 34 entries), same 2-pass algorithm:
1. Whitespace: trim, collapse runs, insert space at letter-digit boundary
2. Brand corrections: regex with word boundaries, sorted longest-first

**Step 4: Run test to verify pass**

**Step 5: Commit**

```bash
git add web/src/lib/textCleaner.js web/src/lib/__tests__/textCleaner.test.js
git commit -m "feat(web): port text cleaner with brand corrections"
```

### Task 1.2: Port column_mapper.js

**Files:**
- Create: `web/src/lib/columnMapper.js`
- Create: `web/src/lib/__tests__/columnMapper.test.js`

**Step 1: Write the failing test**

Tests for: exact header match, synonym match (case-insensitive), fuzzy fallback (Fuse.js threshold 0.25), missing required detection, applyMapping key renaming.

**Step 2: Run test — FAIL**

**Step 3: Write implementation**

Port from `src/column_mapper.py`:
- Same SYNONYMS dict (9 field types, same synonym lists)
- Same REQUIRED array: ['article', 'pvente', 'ppro', 'ppro_htva']
- Pass 1: exact + substring match (case-insensitive)
- Pass 2: fuzzy via Fuse.js (threshold 0.25 = ~75% similarity, ignoreLocation: true)
- `autoMap(headers)` returns mapping dict
- `missingRequired(mapping)` returns array of missing keys
- `applyMapping(mapping, rawRow)` renames keys

**Step 4: Run test — PASS**

**Step 5: Commit**

```bash
git add web/src/lib/columnMapper.js web/src/lib/__tests__/columnMapper.test.js
git commit -m "feat(web): port column mapper with fuzzy matching (Fuse.js)"
```

### Task 1.3: Port file reader (SheetJS)

**Files:**
- Create: `web/src/lib/fileReader.js`
- Create: `web/src/lib/__tests__/fileReader.test.js`

**Step 1: Write tests** for coerceRow (price coercion, string trimming) and formatPrice

**Step 2: Write implementation**

- `parseFile(file, mappingOverride)` — reads File via arrayBuffer, XLSX.read(), extracts headers from row 1, auto-maps, coerces types
- Supports .xlsx, .xls, .csv (SheetJS handles all three natively, auto-detects CSV delimiters including `;`)
- `coerceRow(row)` — prices to float (strip euro, replace comma), strings trimmed
- `formatPrice(value)` — float to "X,XX" (French decimal)

**Step 3: Run tests — PASS**

**Step 4: Commit**

```bash
git commit -m "feat(web): port Excel/CSV/XLS reader with SheetJS"
```

### Task 1.4: Port config and history (localStorage)

**Files:**
- Create: `web/src/lib/config.js`
- Create: `web/src/lib/history.js`
- Create: `web/src/lib/__tests__/config.test.js`
- Create: `web/src/lib/__tests__/history.test.js`

**Step 1: Write tests** (need jsdom env — `npm install -D jsdom`, add `test: { environment: 'jsdom' }` to vite config)

**Step 2: Write implementations**

config.js: localStorage with `gfp_` prefix. Keys: printer_url, label_size, last_mapping, selected_printer. Same LABEL_SIZES dict (5 sizes). `getConfig(key)`, `setConfig(key, value)`, `getLabelSizeInfo()`.

history.js: localStorage key `gfp_history`. Max 100 entries, newest first. `addHistory(product, fmt)`, `getHistory()`. Timestamp in fr-BE locale format.

**Step 3: Run tests — PASS**

**Step 4: Commit**

```bash
git commit -m "feat(web): port config (localStorage) and history managers"
```

### Task 1.5: Port PDF generator (pdf-lib)

**Files:**
- Create: `web/src/lib/pdfGenerator.js`
- Create: `web/src/lib/__tests__/pdfGenerator.test.js`

**Step 1: Write tests** — verify generateLabel and generateA4 return Uint8Array with PDF magic header

**Step 2: Write implementation**

Port from `src/pdf_generator.py`. Key conversions:
- 1mm = 2.83465pt (same as ReportLab)
- StandardFonts.Helvetica / HelveticaBold (built into pdf-lib)
- `font.widthOfTextAtSize(text, size)` for centering (replaces reportlab stringWidth)
- pdf-lib coordinate system: origin bottom-left (same as ReportLab)

generateLabel(product, sizeOpts):
- Custom page size: width_mm * MM, height_mm * MM
- Golden ratio font stack: fPro=8, fTitle=13, fPrice=21
- Article: bold, centred, 2-line wrap
- Price: bold, centred vertically
- Pro prices: bottom-right, grey #444444

generateA4(product):
- A4 landscape: 841.89 x 595.28 pt
- Header safe zone: 90mm from top
- Article: 48pt bold, shrinks to 20pt if needed, 2-line wrap
- Price: 96pt bold, centred at 65mm from bottom
- P/L: 18pt, bottom-left
- Origine: 18pt, bottom-right
- Pro prices: 18pt, bottom-right

Also: `mergePdfs(pdfBytesArray)` and `downloadPdf(bytes, filename)` utilities.

**Step 3: Run tests — PASS**

**Step 4: Commit**

```bash
git commit -m "feat(web): port PDF generator (labels + A4) with pdf-lib"
```

### Task 1.6: Search utility

**Files:**
- Create: `web/src/lib/search.js`

Simple function: `searchProducts(rows, query, limit)` — case-insensitive substring on article field. Returns `{ suggestions, results }`.

**Commit**

```bash
git commit -m "feat(web): add search utility"
```

---

## Phase 2: Print Server

### Task 2.1: Create the print server

**Files:**
- Create: `print-server/package.json`
- Create: `print-server/server.js`

**Step 1: Write the print server**

Node.js HTTP server on port 9100. Two endpoints:

`GET /status` — returns `{ online, printers, hostname }`
`POST /print` — body `{ pdf, printer, copies }` — decodes base64 PDF, saves temp file, prints via CUPS/SumatraPDF

IMPORTANT: Use `child_process.execFileSync` (NOT `exec`) to prevent shell injection:

```javascript
import { execFileSync } from 'node:child_process';

// Safe: arguments are passed as array, not interpolated into shell string
function getPrinters() {
  try {
    if (process.platform === 'win32') {
      const out = execFileSync('wmic', ['printer', 'get', 'Name'], { encoding: 'utf8' });
      return out.split('\n').map(l => l.trim()).filter(l => l && l !== 'Name');
    }
    const out = execFileSync('lpstat', ['-e'], { encoding: 'utf8' });
    return out.split('\n').map(l => l.trim()).filter(Boolean);
  } catch { return []; }
}

function printPdf(pdfPath, printerName) {
  if (process.platform === 'win32') {
    const sumatra = ['C:\\Program Files\\SumatraPDF\\SumatraPDF.exe',
                     'C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe']
                    .find(p => fs.existsSync(p));
    if (sumatra) {
      execFileSync(sumatra, ['-print-to', printerName, '-silent', pdfPath]);
    }
  } else {
    execFileSync('lp', ['-d', printerName, '-o', 'media=Custom.36x89mm',
                        '-o', 'orientation-requested=4', '-o', 'fit-to-page', pdfPath]);
  }
}
```

CORS enabled for all origins. JSON responses.

**Step 2: Commit**

```bash
git add print-server/
git commit -m "feat: add local print server for Dymo label printing"
```

### Task 2.2: Print server client in web app

**Files:**
- Create: `web/src/lib/printClient.js`

`checkPrintServer()` — GET /status with 3s timeout
`printLabel(pdfBytes, printerName, copies)` — POST /print with base64 PDF

**Commit**

```bash
git commit -m "feat(web): add print server client"
```

---

## Phase 3: React UI Components

### Task 3.1: App shell + layout + Header

**Files:**
- Modify: `web/src/App.jsx`
- Create: `web/src/components/Header.jsx`
- Create: `web/src/hooks/useStore.js`

**useStore.js**: Central state hook with: rows, headers, mapping, fileName, selectedProduct, selectedKeys (Set), format ('label'|'a4'), printerStatus, history. Includes toggleSelection, clearSelection, selectAll helpers.

**Header.jsx**: Navy bar with logo, "Charger Excel" button, file name display, "Changer" button, printer status indicator (green/red dot), "Parametres" button.

**App.jsx**: Full-height flex column. Header + drop zone banner + two-column body (420px left, flex-1 right). File loading wired to parseFile(). Printer status check every 10s.

**Verify in browser, commit**

```bash
git commit -m "feat(web): app shell with header, state hook, file loading"
```

### Task 3.2: Left Panel — Search + Product Table + History

**Files:**
- Create: `web/src/components/LeftPanel.jsx`
- Create: `web/src/components/SearchBar.jsx`
- Create: `web/src/components/ProductTable.jsx`
- Create: `web/src/components/HistoryPanel.jsx`

**SearchBar**: Input with 150ms debounce, suggestion dropdown below.

**ProductTable**: Column headers (checkbox, Article, P/L, Pvente, PPHT, PPTTC). Scrollable rows, max 200 displayed. 48px min touch target. Checkboxes for batch selection (persistent across searches via selectedKeys Set). Row click selects for preview. Alternating row colors.

**HistoryPanel**: Max 20 entries, badge (ETIQ orange / A4 green), article name, timestamp. Click reselects product and sets format.

**LeftPanel**: Composes SearchBar + ProductTable + HistoryPanel in a flex column.

**Verify, commit**

```bash
git commit -m "feat(web): left panel — search, product table, history"
```

### Task 3.3: Right Panel — Format Toggle + Preview Canvas + Actions

**Files:**
- Create: `web/src/components/RightPanel.jsx`
- Create: `web/src/components/PreviewCanvas.jsx`
- Create: `web/src/components/ActionButtons.jsx`
- Create: `web/src/components/FormatToggle.jsx`

**FormatToggle**: Two buttons, active one gets orange-red bg.

**PreviewCanvas**: HTML Canvas (500x360px fixed). Renders label or A4 preview using Canvas API. Direct port of `main_window.py` lines 643-751:
- Label: shadow + white card, golden-ratio fonts, article/price/pro prices
- A4: shadow + white card + optional background PNG, safe-zone geometry (header = 90/210 of height), article/price/P-L/origine/pro prices
- Word-wrap helper with measureText()

**ActionButtons**: Two rows:
1. "Imprimer etiquette", "Exporter PDF A4", "Imprimer A4"
2. "Etiquettes (N)", "A4 (N)", "Decocher tout"

**RightPanel**: Composes all three.

**Verify, commit**

```bash
git commit -m "feat(web): right panel — format toggle, canvas preview, action buttons"
```

### Task 3.4: Mapping Dialog Modal

**Files:**
- Create: `web/src/components/MappingDialog.jsx`

Modal overlay. 6 fields (article*, pvente*, ppro*, ppro_htva*, origine, p_l) with dropdown selectors listing "(ignore)" + Excel headers. Confirm/Cancel buttons. Same as `ui/mapping_dialog.py`.

**Commit**

```bash
git commit -m "feat(web): column mapping dialog"
```

### Task 3.5: Settings Dialog Modal

**Files:**
- Create: `web/src/components/SettingsDialog.jsx`

Modal with: printer URL input + "Tester" button, printer selector dropdown (populated from /status response), label size selector (5 options from LABEL_SIZES), Save/Cancel.

**Commit**

```bash
git commit -m "feat(web): settings dialog with printer URL and label size"
```

### Task 3.6: Wire all actions in App.jsx

**Files:**
- Modify: `web/src/App.jsx`

Wire:
- `onPrintLabel`: generateLabel() -> printLabel() via printClient -> addHistory() -> refresh
- `onExportA4`: generateA4() -> downloadPdf()
- `onPrintA4`: generateA4() -> open PDF in new tab (URL.createObjectURL + window.open)
- `onBatchLabels`: loop checked products -> generateLabel + printLabel each -> addHistory
- `onBatchA4`: loop checked products -> generateA4 each -> mergePdfs -> open for print
- MappingDialog: shown when missingRequired() returns non-empty after file load
- SettingsDialog: toggled by header button
- Drag-drop: onDragOver/onDragLeave/onDrop on root div, accept .xlsx/.xls/.csv
- A4 background: load /a4layout_bg.png as HTMLImageElement for PreviewCanvas

**Verify all features in browser**

**Commit**

```bash
git commit -m "feat(web): wire all actions — print, export, batch, drag-drop, dialogs"
```

---

## Phase 4: PWA + Install Banner

### Task 4.1: Configure vite-plugin-pwa

**Files:**
- Modify: `web/vite.config.js`
- Create: `web/public/pwa-192x192.png`
- Create: `web/public/pwa-512x512.png`

Install `vite-plugin-pwa`. Configure manifest: name "GoForPrice", display standalone, orientation landscape, lang fr, theme_color #1B2B3A. Workbox caches all static assets including the PDF.

**Commit**

```bash
git commit -m "feat(web): configure PWA with service worker and manifest"
```

### Task 4.2: Custom install banner

**Files:**
- Create: `web/src/components/InstallBanner.jsx`

Listens for `beforeinstallprompt` event. Shows banner: "Installer GoForPrice sur votre appareil". Install button triggers prompt. Dismiss saves to localStorage. Hidden if already installed (display-mode: standalone media query).

**Commit**

```bash
git commit -m "feat(web): custom PWA install banner"
```

---

## Phase 5: Polish + Deploy

### Task 5.1: Responsive layout

Make two-column layout responsive:
- Tablet landscape (>= 768px): side-by-side (current design)
- Phone/portrait (< 768px): stacked with tab switching between panels

### Task 5.2: Toast notifications

Create Toast component replacing all alert() calls. Green for success, red for error, auto-dismiss 3s.

### Task 5.3: A4 background image for preview

Convert a4layout_bg.pdf to PNG (one-time script or manual). Load as HTMLImageElement in App.jsx, pass to PreviewCanvas.

### Task 5.4: Full test suite

Run `npx vitest run` — fix any failures.

### Task 5.5: Build and deploy to Cloudflare Pages

```bash
cd /Users/pc/GoForPrize/web && npm run build
npx wrangler pages deploy dist --project-name goforprice
```

---

## Task Dependency Graph

```
Phase 0: Scaffold
  0.1 Vite+React+Tailwind -> 0.2 Assets

Phase 1: Data Layer (parallelizable except where noted)
  1.1 textCleaner
  1.2 columnMapper
  1.3 fileReader (depends on 1.2)
  1.4 config + history
  1.5 pdfGenerator (depends on 1.1, 1.3)
  1.6 search

Phase 2: Print Server (independent of Phase 1)
  2.1 server.js
  2.2 printClient.js

Phase 3: UI (depends on Phase 1 + 2)
  3.1 App shell + Header + useStore
  3.2 LeftPanel
  3.3 RightPanel
  3.4 MappingDialog
  3.5 SettingsDialog
  3.6 Wire all actions
  3.7 Drag and drop (part of 3.6)

Phase 4: PWA (depends on Phase 3)
  4.1 vite-plugin-pwa
  4.2 Install banner

Phase 5: Polish + Deploy (depends on all)
  5.1 Responsive
  5.2 Toasts
  5.3 A4 bg image
  5.4 Test suite
  5.5 Deploy
```

## Files Created (~30 files)

```
web/
  package.json, vite.config.js, index.html
  public/  (favicon.svg, logo.png, a4layout_bg.pdf, a4layout_bg.png, pwa-*.png)
  src/
    main.jsx, index.css, App.jsx
    hooks/useStore.js
    lib/  (textCleaner, columnMapper, fileReader, pdfGenerator, search, config, history, printClient)
    lib/__tests__/  (6 test files)
    components/  (Header, LeftPanel, SearchBar, ProductTable, HistoryPanel, RightPanel,
                  FormatToggle, PreviewCanvas, ActionButtons, MappingDialog, SettingsDialog,
                  InstallBanner, Toast)
print-server/
  package.json, server.js
```
