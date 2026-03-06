# -*- mode: python ; coding: utf-8 -*-
# Build with:  build.bat  (must run on Windows to produce GoForPrice.exe)
# Or push to GitHub — Actions will build and attach the .exe automatically.

import sys
from PyInstaller.utils.hooks import collect_all, collect_data_files

# ── Collect runtime data/DLLs for libraries that need it ─────────────────────
fitz_datas, fitz_bins, fitz_hidden = collect_all('fitz')          # PyMuPDF
dnd_datas,  dnd_bins,  dnd_hidden  = collect_all('tkinterdnd2')   # drag-and-drop DLL
ctk_datas  = collect_data_files('customtkinter')                   # UI themes / JSON

# win32 hidden imports only apply on Windows
win32_hidden = (
    ['win32print', 'win32api', 'win32con', 'pywintypes']
    if sys.platform == 'win32' else []
)

a = Analysis(
    ['app.py'],
    pathex=[],
    binaries=fitz_bins + dnd_bins,
    datas=[
        ('assets', 'assets'),          # logo, A4 layout PDF, etc.
    ] + fitz_datas + dnd_datas + ctk_datas,
    hiddenimports=[
        'tkinterdnd2',
        'fitz', 'fitz._fitz', 'pymupdf',
    ] + win32_hidden + fitz_hidden + dnd_hidden,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='GoForPrice',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    # UPX can corrupt PyMuPDF / MuPDF DLLs — exclude them
    upx_exclude=['_fitz*.pyd', 'mupdf*.dll', 'libmupdf*.dll'],
    runtime_tmpdir=None,
    console=False,                     # no black console window
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)
