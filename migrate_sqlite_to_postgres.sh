#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

SQLITE_PATH="${SQLITE_PATH:-data/fans.db}"
POSTGRES_URL="${POSTGRES_URL:-}"
PYTHON_BIN="${PYTHON_BIN:-python3}"

usage() {
  cat <<'EOF'
Usage: ./migrate_sqlite_to_postgres.sh [--sqlite-path <path>] [--postgres-url <url>]

One-off migration from the legacy SQLite database into PostgreSQL using the
existing application sync logic.

Examples:
  ./migrate_sqlite_to_postgres.sh --sqlite-path data/fans.db --postgres-url postgresql+psycopg://user:pass@127.0.0.1:5432/fan_graphs
  ./migrate_sqlite_to_postgres.sh --postgres-url "$(grep '^DATABASE_URL=' .env.deploy | cut -d= -f2-)"
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --sqlite-path)
      SQLITE_PATH="$2"
      shift 2
      ;;
    --postgres-url)
      POSTGRES_URL="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ ! -f "$SQLITE_PATH" ]]; then
  echo "SQLite file not found: $SQLITE_PATH"
  exit 1
fi

if [[ -z "$POSTGRES_URL" ]]; then
  if [[ -f ".env.deploy" ]]; then
    POSTGRES_URL="$(grep '^DATABASE_URL=' .env.deploy | cut -d= -f2- || true)"
  fi
fi

if [[ -z "$POSTGRES_URL" ]]; then
  echo "Postgres URL is required."
  usage
  exit 1
fi

DATABASE_URL="sqlite:///$PWD/${SQLITE_PATH#./}" \
POSTGRES_DATABASE_URL="$POSTGRES_URL" \
"$PYTHON_BIN" - <<'PY'
from backend.database import init_db
from backend.main import sync_all_data_to_postgres
from backend.database import SessionLocal, mirror_db_session
from backend.main import get_database_counts

init_db()
sync_all_data_to_postgres()

with SessionLocal() as sqlite_db, mirror_db_session() as postgres_db:
    sqlite_counts = get_database_counts(sqlite_db)
    postgres_counts = get_database_counts(postgres_db)

print("SQLite counts:")
for key, value in sqlite_counts.items():
    print(f"  {key}: {value}")

print("\nPostgres counts:")
for key, value in postgres_counts.items():
    print(f"  {key}: {value}")
PY

echo
echo "SQLite to Postgres migration complete."
