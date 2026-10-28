#!/usr/bin/env bash
echo "Starting Taste-Gap Finder backend..."
cd "$(dirname "$0")"
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
