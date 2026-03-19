@echo off
echo ===================================
echo  GoForPrice - Serveur d'impression
echo ===================================
echo.

:: Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js n'est pas installe!
    echo Telechargez-le sur: https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo Demarrage du serveur d'impression...
echo Gardez cette fenetre ouverte.
echo.
node server.js
pause
