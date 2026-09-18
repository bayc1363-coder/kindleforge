@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Creating venv...
  py -3 -m venv .venv 2>nul || python -m venv .venv
  .\.venv\Scripts\pip.exe install -r requirements.txt
)
echo Starting KindleForge backend on http://127.0.0.1:8001
echo Ollama must be running (ollama serve / desktop app).
echo.
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001
pause
