#!/usr/bin/env bash
set -euo pipefail

cd /app

python -m backend.db_management prepare-configured-databases
exec uvicorn backend.main:app --host 0.0.0.0 --port 8000
