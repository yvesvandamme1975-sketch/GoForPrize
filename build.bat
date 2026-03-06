@echo off
echo ============================================================
echo  GoForPrice — Build single-file Windows executable
echo ============================================================
echo.

echo [1/3] Installing / updating dependencies...
pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo ERROR: pip install failed.
    pause & exit /b 1
)

echo [2/3] Running PyInstaller...
pyinstaller GoForPrice.spec --clean --noconfirm
if errorlevel 1 (
    echo ERROR: PyInstaller build failed.
    pause & exit /b 1
)

echo [3/3] Done.
echo.
echo  Output: dist\GoForPrice.exe
echo.
pause
