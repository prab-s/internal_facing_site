#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

ENV_FILE="${ENV_FILE:-.env.deploy}"
COMPOSE_FILE="${COMPOSE_FILE:-deploy-compose.yml}"
COMPOSE_BIN="${COMPOSE_BIN:-podman compose}"
PG_CLIENT_IMAGE="${PG_CLIENT_IMAGE:-docker.io/library/postgres:16}"
OUTPUT_DIR="${OUTPUT_DIR:-backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
ARCHIVE_NAME="${ARCHIVE_NAME:-fan_graphs_backup_${TIMESTAMP}.zip}"
COMPOSE_ARGS=(-f "${COMPOSE_FILE}")
PG_TOOL_DATABASE_URL=""

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
    --output-dir)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --archive-name)
      ARCHIVE_NAME="$2"
      shift 2
      ;;
    --mode)
      BACKUP_MODE="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      echo "Usage: $0 [--sit|--deploy|--env-file <file>] [--output-dir <dir>] [--archive-name <file>] [--mode auto|compose|url]"
      exit 1
      ;;
  esac
done

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ -n "${COMPOSE_PROFILES:-}" ]]; then
  IFS=',' read -r -a _compose_profiles <<< "${COMPOSE_PROFILES}"
  for profile in "${_compose_profiles[@]}"; do
    profile="${profile// /}"
    if [[ -n "$profile" ]]; then
      COMPOSE_ARGS+=(--profile "$profile")
    fi
  done
fi

mkdir -p "$OUTPUT_DIR"
STAGING_DIR="$(mktemp -d)"
trap 'rm -rf "$STAGING_DIR"' EXIT

DB_DUMP_PATH="$STAGING_DIR/postgres_dump.sql"
BACKUP_MODE="${BACKUP_MODE:-${BACKUP_MODE:-auto}}"
if [[ "$BACKUP_MODE" == "auto" ]]; then
  if [[ "${DATABASE_URL:-}" == *"@postgres:"* ]]; then
    BACKUP_MODE="compose"
  else
    BACKUP_MODE="url"
  fi
fi

dump_postgres_via_compose() {
  ${COMPOSE_BIN} "${COMPOSE_ARGS[@]}" exec -T postgres pg_dump \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" \
    --no-owner \
    --no-privileges > "${DB_DUMP_PATH}"
}

dump_postgres_via_url() {
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "DATABASE_URL is required for URL-mode backup."
    exit 1
  fi

  PG_TOOL_DATABASE_URL="$(python3 - <<'PY' "${DATABASE_URL}"
from sqlalchemy.engine import make_url
import sys
url = make_url(sys.argv[1])
drivername = url.drivername
if "+" in drivername:
    drivername = drivername.split("+", 1)[0]
url = url.set(drivername=drivername)
print(url.render_as_string(hide_password=False))
PY
)"

  podman run --rm --network host \
    -e DATABASE_URL="${PG_TOOL_DATABASE_URL}" \
    "${PG_CLIENT_IMAGE}" \
    sh -lc 'pg_dump "$DATABASE_URL" --no-owner --no-privileges' > "${DB_DUMP_PATH}"
}

backup_optional_wordpress_data() {
  if ! podman ps --format '{{.Names}}' | grep -qx 'fan-graphs-wordpress'; then
    return 0
  fi

  if podman ps --format '{{.Names}}' | grep -qx 'fan-graphs-wordpress-db'; then
    ${COMPOSE_BIN} "${COMPOSE_ARGS[@]}" exec -T wordpress_db mariadb-dump \
      -u "${WORDPRESS_DB_USER}" \
      "-p${WORDPRESS_DB_PASSWORD}" \
      "${WORDPRESS_DB_NAME}" > "${STAGING_DIR}/wordpress_dump.sql"
  fi

  mkdir -p "${STAGING_DIR}/wordpress"
  ${COMPOSE_BIN} "${COMPOSE_ARGS[@]}" exec -T wordpress \
    tar -C /var/www/html -cf - wp-content > "${STAGING_DIR}/wordpress/wp-content.tar"
}

case "$BACKUP_MODE" in
  compose)
    dump_postgres_via_compose
    backup_optional_wordpress_data
    ;;
  url)
    dump_postgres_via_url
    ;;
  *)
    echo "Unsupported BACKUP_MODE: $BACKUP_MODE"
    exit 1
    ;;
esac

mkdir -p "$STAGING_DIR/data"

for media_dir in product_images product_graphs product_pdfs; do
  if [[ -d "data/${media_dir}" ]]; then
    cp -a "data/${media_dir}" "$STAGING_DIR/data/${media_dir}"
  fi
done

cat > "$STAGING_DIR/README.txt" <<EOF
Internal Facing backup bundle
Generated: ${TIMESTAMP}
Mode: ${BACKUP_MODE}
Env file: ${ENV_FILE}

Contents:
- postgres_dump.sql : PostgreSQL database dump
- data/product_images : uploaded product images (if present)
- data/product_graphs : generated graph images (if present)
- data/product_pdfs : future PDF assets (if present)
- wordpress_dump.sql : WordPress MariaDB dump (if present)
- wordpress/wp-content.tar : WordPress content volume snapshot (if present)
EOF

python3 - <<'PY' "$STAGING_DIR" "${OUTPUT_DIR}/${ARCHIVE_NAME}"
import os
import sys
import zipfile

source_dir = sys.argv[1]
archive_path = sys.argv[2]

with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    for root, _, files in os.walk(source_dir):
        for file_name in files:
            full_path = os.path.join(root, file_name)
            relative_path = os.path.relpath(full_path, source_dir)
            archive.write(full_path, relative_path)

print(archive_path)
PY

echo
echo "Backup written to:"
echo "  ${OUTPUT_DIR}/${ARCHIVE_NAME}"
