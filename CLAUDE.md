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

## Customer
- Go For Prize — Belgian retail (currency EUR, locale fr-BE)
- Uses pre-printed A4 paper (header zone = top 90mm reserved)
- Dymo LabelWriter for price labels (89x36mm default)
