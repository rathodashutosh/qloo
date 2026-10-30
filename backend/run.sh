#!/usr/bin/env bash
echo "Starting Taste-Gap Finder backend..."
cd "$(dirname "$0")"
if [ -f ".venv/bin/python" ]; then
    PYTHON_BIN=".venv/bin/python"
elif command -v python3 &>/dev/null; then
    PYTHON_BIN="python3"
else
    PYTHON_BIN="python"
fi
$PYTHON_BIN -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
