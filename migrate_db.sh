#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

DEFAULT_PYTHON_BIN="python3"
if [[ -x ".venv/bin/python" ]] && ".venv/bin/python" -c "import alembic, psycopg" >/dev/null 2>&1; then
  DEFAULT_PYTHON_BIN=".venv/bin/python"
fi

PYTHON_BIN="${PYTHON_BIN:-$DEFAULT_PYTHON_BIN}"
ENV_FILE="${ENV_FILE:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --sit)
      ENV_FILE=".env.sit"
      shift
      ;;
    --deploy|--prod)
      ENV_FILE=".env.deploy"
      shift
      ;;
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      echo "Usage: $0 [--sit|--deploy|--env-file <file>]"
      exit 1
      ;;
  esac
done

if [[ -n "$ENV_FILE" && -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ "${DATABASE_URL:-}" == *"@postgres:"* ]]; then
  DATABASE_URL="${DATABASE_URL/@postgres:/@127.0.0.1:}"
fi

"$PYTHON_BIN" -m backend.db_management prepare-configured-databases
