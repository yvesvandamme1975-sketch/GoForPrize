# GoForPrize — Label & Poster Printer

## Architecture
- **Monorepo**: Desktop Python app (root) + Web React app (`web/`)
- Desktop: CustomTkinter GUI + PyInstaller `.exe` — prints to Dymo via win32print
- Web: React 19 + Vite 7 + Tailwind 4 PWA — generates PDFs client-side, downloads for printing
- Print server: `print-server/` — tiny Node HTTP server for local Dymo printing via network

## Web App (`web/`)

### Commands
- `npm run dev` — local dev server (port 5173)
- `npm run build` — production build to `web/dist/`
- `npm start` — production server (Express 5, port 3000)
- `npx vitest run` — run all tests (47 tests across 6 files)

### Key Libraries
- SheetJS (`xlsx`) for Excel/CSV/XLS parsing (client-side)
- `pdf-lib` for PDF generation (client-side)
- `fuse.js` for fuzzy column mapping
- `express@5` for production static server (note: wildcard route = `/{*path}`, NOT `*`)

### Testing
- Vitest with jsdom environment
- IMPORTANT: `vitest.config.js` is separate from `vite.config.js` — vite-plugin-pwa breaks jsdom env if combined
- Tests: `web/src/lib/__tests__/`

### Preview Canvas
- Font sizes computed from **pixel** card height (DW=460 fixed), NOT from mm dimensions
- Must match desktop app's tkinter canvas exactly (golden ratio: 1.61)
- `drawLabel()` and `drawA4()` in `PreviewCanvas.jsx`

### Data
- Excel data can have duplicate rows — React keys need index suffix (`${key}_${i}`)
- Column mapper: 2-pass (exact/substring, then Fuse.js fuzzy at 0.25 threshold)
- 42 brand corrections in `textCleaner.js`
- Settings/history stored in localStorage with `gfp_` prefix

## Deployment (Railway)
- GitHub repo connected, auto-deploys on push to `main`
- Root directory: `/web` (critical — prevents Railway from detecting Python `requirements.txt`)
- Dockerfile in `web/Dockerfile` — Node 22 Alpine, two-stage build
- URL: https://goforprize-production.up.railway.app
- Domain: goforprize-production.up.railway.app

## Desktop App (root)
- Python 3.x + CustomTkinter
- Entry point: `app.py`, UI: `ui/main_window.py`
- Build: `pyinstaller GoForPrice.spec`
- Config: `config.json`, history: `history.json`
- DO NOT modify `requirements.txt` without checking Railway impact
- Product keys in UI include row index `(article, pvente, idx)` — needed for duplicate Excel rows
- Auto-detect printer prefers "dymo"/"label" in name; customer must delete `config.json` to reset saved printer
- `.exe` build: GitHub Actions on push to `main`; also `gh workflow run "Build Windows EXE"`; JS-only changes don't need rebuild
- A4 preview font multipliers: `fPro=ah*0.04`, `fTitle=fPro*1.61*1.2`, `fPrice=fPro*1.61*1.61` — DO NOT increase, causes overlap with 2-line articles
- Preview and PDF use DIFFERENT code — fix BOTH when changing layout (preview in `main_window.py` + `PreviewCanvas.jsx`, PDF in `pdf_generator.py` + `pdfGenerator.js`)
- Customer uses .exe on Windows PC as primary tool — always test .exe, not just web app

## Dymo Printing
- Label PDF: 89mm × 36mm **landscape** (DO NOT change to portrait)
- macOS/CUPS: `media=Custom.36x89mm`, `orientation-requested=4`, `fit-to-page`
- Windows: SumatraPDF with `-print-settings fit` (best), then `win32api.ShellExecute("printto")`, then PowerShell, last resort `os.startfile("print")`
- CRITICAL: `win32api.ShellExecute("printto")` is ASYNC — batch print must use unique temp files per product, not reuse one file
- Windows fallback `os.startfile("print")` ignores printer_name — always prints to default printer
- Windows driver MUST be set to **99012 Large Address** (89×36mm) in Printer Preferences
- Python printer code (`src/printer.py`) and PDF generator (`src/pdf_generator.py`) were stable as of commit `3455209` (March 6) — do NOT refactor without testing on actual Dymo hardware
- GitHub Actions builds .exe on every push to `main` → releases at `latest` tag
- ALWAYS test on real Dymo hardware before shipping — preview/PDF can look correct but print wrong
- macOS CUPS: if Dymo shows offline, run `cupsenable DYMO_LabelWriter_550 && cancel -a DYMO_LabelWriter_550`
- Web app JS pdfGenerator.js and Python pdf_generator.py MUST produce identical page sizes (both 89×36mm landscape)

## Customer
- Go For Prize — Belgian retail (currency EUR, locale fr-BE)
- Uses pre-printed A4 paper (header zone = top 90mm reserved)
- Dymo LabelWriter 550 for price labels (89×36mm, label type 99012 Large Address)
- Setup: Android tablet (web app) + Windows PC with Dymo (runs .exe)
