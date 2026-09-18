@echo off
cd /d "%~dp0"
echo === KindleForge ===
echo 1) Backend :8001  2) Frontend :8000  3) Open browser
echo.

start "KindleForge Backend" cmd /k "cd /d %~dp0backend && start_backend.bat"
timeout /t 2 /nobreak >nul
start "KindleForge Frontend" cmd /k "cd /d %~dp0 && py -3 -m http.server 8000 2>nul || python -m http.server 8000"
timeout /t 1 /nobreak >nul
start http://127.0.0.1:8000/index.html
echo Opened http://127.0.0.1:8000/index.html
echo Keep both terminal windows open while working.
pause
