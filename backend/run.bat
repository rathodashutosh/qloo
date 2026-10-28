@echo off
echo Starting Taste-Gap Finder backend...
cd /d "%~dp0"
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
