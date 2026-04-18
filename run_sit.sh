#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

DEFAULT_PYTHON_BIN="python3"
if [[ -x ".venv/bin/python" ]] && ".venv/bin/python" -c "import alembic, psycopg" >/dev/null 2>&1; then
  DEFAULT_PYTHON_BIN=".venv/bin/python"
fi
PYTHON_BIN="${PYTHON_BIN:-$DEFAULT_PYTHON_BIN}"
BASE_ENV_FILE="${BASE_ENV_FILE:-}"
ENV_FILE="${ENV_FILE:-.env.sit}"

if [[ -n "$BASE_ENV_FILE" && -f "$BASE_ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$BASE_ENV_FILE"
  set +a
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

cleanup() {
  echo
  echo "Stopping SIT services..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

if [[ "${DATABASE_URL:-}" == postgresql* ]]; then
  if ! "$PYTHON_BIN" -c "import psycopg" >/dev/null 2>&1; then
    echo
    echo "SIT startup aborted:"
    echo "  A PostgreSQL database is configured, but the active Python environment does not have 'psycopg' installed."
    echo
    echo "Fix it with:"
    echo "  $PYTHON_BIN -m pip install -r backend/requirements.txt"
    echo
    exit 1
  fi
fi

if ! "$PYTHON_BIN" -c "import alembic" >/dev/null 2>&1; then
  echo
  echo "SIT startup aborted:"
  echo "  The active Python environment does not have 'alembic' installed."
  echo
  echo "Fix it with:"
  echo "  $PYTHON_BIN -m pip install -r backend/requirements.txt"
  echo
  exit 1
fi

echo "Preparing SIT database schema..."
"$PYTHON_BIN" -m backend.db_management prepare-configured-databases

echo "Starting SIT backend on http://0.0.0.0:8002"
"$PYTHON_BIN" -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8002 &
BACKEND_PID=$!

echo "Starting SIT frontend on http://0.0.0.0:8001"
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo
echo "SIT is running:"
echo "  Frontend (local): http://127.0.0.1:8001"
echo "  API (local):      http://127.0.0.1:8002/api"
echo "  Frontend (LAN):   http://<XPS-LAN-IP>:8001"
echo
wait
