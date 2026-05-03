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
SIT_BACKEND_PID_FILE="${SIT_BACKEND_PID_FILE:-.run_sit_backend.pid}"
SIT_FRONTEND_PID_FILE="${SIT_FRONTEND_PID_FILE:-.run_sit_frontend.pid}"
SIT_PUBLIC_PID_FILE="${SIT_PUBLIC_PID_FILE:-.run_sit_public.pid}"
SIT_BACKEND_URL="${SIT_BACKEND_URL:-http://127.0.0.1:8002}"
SIT_FRONTEND_URL="${SIT_FRONTEND_URL:-http://127.0.0.1:8001}"
SIT_PUBLIC_URL="${SIT_PUBLIC_URL:-http://127.0.0.1:8005}"
SIT_PUBLIC_SITE_NAME="${SIT_PUBLIC_SITE_NAME:-Vent-tech catalogue (SIT)}"
export PUBLIC_CATALOGUE_SITE_URL="${PUBLIC_CATALOGUE_SITE_URL:-$SIT_PUBLIC_URL}"
export PUBLIC_CATALOGUE_BACKEND_API_BASE_URL="${PUBLIC_CATALOGUE_BACKEND_API_BASE_URL:-$SIT_BACKEND_URL}"
export PUBLIC_CATALOGUE_SITE_NAME="${PUBLIC_CATALOGUE_SITE_NAME:-$SIT_PUBLIC_SITE_NAME}"

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

if [[ -z "${CMS_API_TOKEN:-}" ]]; then
  echo
  echo "SIT startup aborted:"
  echo "  CMS_API_TOKEN is required for the customer-facing site to read catalogue data from the backend on port 8002."
  echo "  Add CMS_API_TOKEN to .env.sit, then rerun ./run_sit.sh."
  echo
  exit 1
fi

cleanup() {
  echo
  echo "Stopping SIT services..."
  if [[ -n "${BACKEND_PID:-}" ]]; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [[ -n "${FRONTEND_PID:-}" ]]; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
  if [[ -n "${PUBLIC_PID:-}" ]]; then
    kill "$PUBLIC_PID" 2>/dev/null || true
  fi
  rm -f "$SIT_BACKEND_PID_FILE" "$SIT_FRONTEND_PID_FILE"
  rm -f "$SIT_PUBLIC_PID_FILE"
}
trap cleanup EXIT INT TERM

stop_pid_file_process() {
  local pid_file="$1"
  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
    rm -f "$pid_file"
  fi
}

stop_port_listener() {
  local port="$1"
  local pids
  pids="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "Stopping existing listener(s) on port $port: $pids"
    kill $pids 2>/dev/null || true
    sleep 1
    pids="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      kill -9 $pids 2>/dev/null || true
    fi
  fi
}

echo "Checking for stale SIT processes..."
stop_pid_file_process "$SIT_BACKEND_PID_FILE"
stop_pid_file_process "$SIT_FRONTEND_PID_FILE"
stop_pid_file_process "$SIT_PUBLIC_PID_FILE"
stop_port_listener 8002
stop_port_listener 8001
stop_port_listener 8005

wait_for_url() {
  local url="$1"
  local label="$2"
  local timeout="${3:-30}"
  local elapsed=0

  echo "Waiting for ${label} at ${url} ..."
  until curl -sf "$url" >/dev/null; do
    sleep 1
    elapsed=$((elapsed + 1))
    if (( elapsed >= timeout )); then
      echo
      echo "${label} did not become ready within ${timeout}s."
      exit 1
    fi
  done
}

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

find_browser_binary() {
  local candidate
  for candidate in chromium chromium-browser google-chrome google-chrome-stable; do
    if command -v "$candidate" >/dev/null 2>&1; then
      command -v "$candidate"
      return 0
    fi
  done
  return 1
}

SIT_CHROMIUM_WRAPPER="$(pwd)/scripts/sit-chromium-wrapper.sh"
if [[ -n "${CHROMIUM_BIN:-}" ]]; then
  echo "Using CHROMIUM_BIN from environment: $CHROMIUM_BIN"
elif CHROMIUM_BIN="$(find_browser_binary)"; then
  export CHROMIUM_BIN
  echo "Using host Chromium-compatible browser for SIT PDF rendering: $CHROMIUM_BIN"
elif command -v podman >/dev/null 2>&1 && podman image exists "${SIT_CHROMIUM_IMAGE:-localhost/fan-graphs:latest}"; then
  export CHROMIUM_BIN="$SIT_CHROMIUM_WRAPPER"
  echo "Using Podman Chromium fallback for SIT PDF rendering: $CHROMIUM_BIN"
else
  echo
  echo "SIT startup aborted:"
  echo "  Product PDF generation needs a Chromium-compatible browser."
  echo
  echo "Fix it in one of these ways:"
  echo "  1. Install Chromium or Chrome on the host and re-run ./run_sit.sh"
  echo "  2. Build the deploy image first so SIT can use the Podman fallback:"
  echo "     ./redeploy.sh"
  echo
  exit 1
fi

echo "Preparing SIT database schema..."
"$PYTHON_BIN" -m backend.db_management prepare-configured-databases

echo "Starting SIT backend on http://0.0.0.0:8002"
"$PYTHON_BIN" -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8002 &
BACKEND_PID=$!
echo "$BACKEND_PID" > "$SIT_BACKEND_PID_FILE"

wait_for_url "${SIT_BACKEND_URL}/api/health" "SIT backend" 30

echo "Starting SIT customer-facing site on http://0.0.0.0:8005"
cd customer_facing
BACKEND_API_BASE_URL="$PUBLIC_CATALOGUE_BACKEND_API_BASE_URL" \
PUBLIC_SITE_URL="$PUBLIC_CATALOGUE_SITE_URL" \
SITE_NAME="$PUBLIC_CATALOGUE_SITE_NAME" \
CMS_API_TOKEN="${CMS_API_TOKEN:-}" \
"$PYTHON_BIN" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8005 &
PUBLIC_PID=$!
echo "$PUBLIC_PID" > "../$SIT_PUBLIC_PID_FILE"
cd ..

wait_for_url "$SIT_PUBLIC_URL" "SIT customer-facing site" 30

echo "Starting SIT frontend on http://0.0.0.0:8001"
cd frontend
npm run dev -- --host 0.0.0.0 --port 8001 --strictPort &
FRONTEND_PID=$!
echo "$FRONTEND_PID" > "../$SIT_FRONTEND_PID_FILE"
cd ..

echo
echo "SIT is running:"
echo "  Frontend (local):        ${SIT_FRONTEND_URL}"
echo "  API (local):             ${SIT_BACKEND_URL}/api"
echo "  Customer site (local):   ${SIT_PUBLIC_URL}"
echo "  Frontend (LAN):          http://<XPS-LAN-IP>:8001"
echo "  Customer site (LAN):     http://<XPS-LAN-IP>:8005"
echo
wait
