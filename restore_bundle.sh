#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

timestamp() {
  date +"[%A, %d/%m/%Y %H:%M:%S]"
}

log() {
  echo
  timestamp
  echo "$*"
}

human_size() {
  python3 - <<'PY' "$1"
import sys
size = float(sys.argv[1])
units = ["B", "KB", "MB", "GB", "TB"]
for unit in units:
    if size < 1024 or unit == units[-1]:
        print(f"{size:.1f} {unit}")
        break
    size /= 1024
PY
}

stream_file_with_progress() {
  local file_path="$1"
  local description="$2"
  local size_bytes
  size_bytes="$(stat -c%s "$file_path")"
  echo "    ${description}: $(human_size "$size_bytes")" >&2
  if [[ -n "${PV_BIN:-}" ]]; then
    "${PV_BIN}" -petrafb -s "$size_bytes" "$file_path"
  else
    cat "$file_path"
  fi
}

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup-zip-path>"
  exit 1
fi

ARCHIVE_PATH="$1"
if [[ ! -f "$ARCHIVE_PATH" ]]; then
  echo "Backup archive not found: $ARCHIVE_PATH"
  exit 1
fi

shift

ENV_FILE="${ENV_FILE:-.env.deploy}"
COMPOSE_FILE="${COMPOSE_FILE:-deploy-compose.yml}"
COMPOSE_BIN="${COMPOSE_BIN:-podman compose}"
PG_CLIENT_IMAGE="${PG_CLIENT_IMAGE:-docker.io/library/postgres:16}"
COMPOSE_ARGS=(-f "${COMPOSE_FILE}")
MIGRATE_DB_SCRIPT="${MIGRATE_DB_SCRIPT:-./migrate_db.sh}"
PG_TOOL_DATABASE_URL=""
PODMAN_BIN="${PODMAN_BIN:-podman}"
POSTGRES_CONTAINER_NAME="${POSTGRES_CONTAINER_NAME:-fan-graphs-postgres}"
WORDPRESS_DB_CONTAINER_NAME="${WORDPRESS_DB_CONTAINER_NAME:-fan-graphs-wordpress-db}"
WORDPRESS_CONTAINER_NAME="${WORDPRESS_CONTAINER_NAME:-fan-graphs-wordpress}"
PV_BIN="${PV_BIN:-$(command -v pv || true)}"

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
    --mode)
      RESTORE_MODE="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      echo "Usage: $0 <backup-zip-path> [--sit|--deploy|--env-file <file>] [--mode auto|compose|url]"
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

STAGING_DIR="$(mktemp -d)"
trap 'rm -rf "$STAGING_DIR"' EXIT

log "Extracting backup archive"
echo "  Archive: ${ARCHIVE_PATH}"
echo "  Staging: ${STAGING_DIR}"

python3 - <<'PY' "$ARCHIVE_PATH" "$STAGING_DIR"
import sys
import zipfile

archive_path = sys.argv[1]
target_dir = sys.argv[2]

with zipfile.ZipFile(archive_path, "r") as archive:
    archive.extractall(target_dir)
PY

DB_DUMP_PATH="${STAGING_DIR}/postgres_dump.sql"
if [[ ! -f "$DB_DUMP_PATH" ]]; then
  echo "Backup archive does not contain postgres_dump.sql"
  exit 1
fi
echo "  PostgreSQL dump: ${DB_DUMP_PATH}"

RESTORE_MODE="${RESTORE_MODE:-${RESTORE_MODE:-auto}}"
if [[ "$RESTORE_MODE" == "auto" ]]; then
  if [[ "${DATABASE_URL:-}" == *"@postgres:"* ]]; then
    RESTORE_MODE="compose"
  else
    RESTORE_MODE="url"
  fi
fi

restore_postgres_via_compose() {
  log "Restoring PostgreSQL via compose service"
  echo "  Database: ${POSTGRES_DB}"
  if ${PODMAN_BIN} container exists "${POSTGRES_CONTAINER_NAME}" >/dev/null 2>&1; then
    echo "  Using existing container: ${POSTGRES_CONTAINER_NAME}"
    ${PODMAN_BIN} start "${POSTGRES_CONTAINER_NAME}" >/dev/null 2>&1 || true
  else
    echo "  Starting compose postgres service"
    ${COMPOSE_BIN} "${COMPOSE_ARGS[@]}" up -d postgres
  fi

  echo "  Resetting public schema"
  ${PODMAN_BIN} exec -i "${POSTGRES_CONTAINER_NAME}" psql \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" \
    -v ON_ERROR_STOP=1 \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid(); DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO ${POSTGRES_USER}; GRANT ALL ON SCHEMA public TO public;"

  echo "  Importing PostgreSQL dump"
  stream_file_with_progress "${DB_DUMP_PATH}" "PostgreSQL dump stream" | ${PODMAN_BIN} exec -i "${POSTGRES_CONTAINER_NAME}" psql \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" \
    -v ON_ERROR_STOP=1
}

restore_postgres_via_url() {
  log "Restoring PostgreSQL via direct URL"
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "DATABASE_URL is required for URL-mode restore."
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

  echo "  Resetting public schema"
  ${PODMAN_BIN} run --rm --network host \
    -e DATABASE_URL="${PG_TOOL_DATABASE_URL}" \
    "${PG_CLIENT_IMAGE}" \
    sh -lc 'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid(); DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO CURRENT_USER; GRANT ALL ON SCHEMA public TO public;"'

  echo "  Importing PostgreSQL dump"
  stream_file_with_progress "${DB_DUMP_PATH}" "PostgreSQL dump stream" | ${PODMAN_BIN} run --rm --network host -i \
    -e DATABASE_URL="${PG_TOOL_DATABASE_URL}" \
    "${PG_CLIENT_IMAGE}" \
    sh -lc 'psql "$DATABASE_URL" -v ON_ERROR_STOP=1'
}

restore_optional_wordpress_data() {
  local wordpress_dump_path="${STAGING_DIR}/wordpress_dump.sql"
  local wordpress_content_tar="${STAGING_DIR}/wordpress/wp-content.tar"

  if [[ ! -f "${wordpress_dump_path}" ]] && [[ ! -f "${wordpress_content_tar}" ]]; then
    log "No WordPress data in backup bundle"
    return 0
  fi

  log "Restoring WordPress data"

  if ${PODMAN_BIN} container exists "${WORDPRESS_DB_CONTAINER_NAME}" >/dev/null 2>&1; then
    ${PODMAN_BIN} start "${WORDPRESS_DB_CONTAINER_NAME}" >/dev/null 2>&1 || true
  fi
  if ${PODMAN_BIN} container exists "${WORDPRESS_CONTAINER_NAME}" >/dev/null 2>&1; then
    ${PODMAN_BIN} start "${WORDPRESS_CONTAINER_NAME}" >/dev/null 2>&1 || true
  fi
  if ! ${PODMAN_BIN} container exists "${WORDPRESS_DB_CONTAINER_NAME}" >/dev/null 2>&1 || ! ${PODMAN_BIN} container exists "${WORDPRESS_CONTAINER_NAME}" >/dev/null 2>&1; then
    ${COMPOSE_BIN} "${COMPOSE_ARGS[@]}" up -d wordpress_db wordpress
  fi

  if [[ -f "${wordpress_dump_path}" ]]; then
    echo "  Importing WordPress MariaDB dump"
    ${PODMAN_BIN} exec -i "${WORDPRESS_DB_CONTAINER_NAME}" mariadb \
      -u root \
      "-p${WORDPRESS_DB_ROOT_PASSWORD}" \
      -e "DROP DATABASE IF EXISTS \`${WORDPRESS_DB_NAME}\`; CREATE DATABASE \`${WORDPRESS_DB_NAME}\`; GRANT ALL PRIVILEGES ON \`${WORDPRESS_DB_NAME}\`.* TO '${WORDPRESS_DB_USER}'@'%'; FLUSH PRIVILEGES;"

    stream_file_with_progress "${wordpress_dump_path}" "WordPress MariaDB dump stream" | ${PODMAN_BIN} exec -i "${WORDPRESS_DB_CONTAINER_NAME}" mariadb \
      -u root \
      "-p${WORDPRESS_DB_ROOT_PASSWORD}" \
      "${WORDPRESS_DB_NAME}"
  fi

  if [[ -f "${wordpress_content_tar}" ]]; then
    echo "  Restoring WordPress wp-content snapshot"
    ${PODMAN_BIN} exec -i "${WORDPRESS_CONTAINER_NAME}" sh -lc 'rm -rf /var/www/html/wp-content && mkdir -p /var/www/html'
    stream_file_with_progress "${wordpress_content_tar}" "WordPress wp-content tar stream" | ${PODMAN_BIN} exec -i "${WORDPRESS_CONTAINER_NAME}" tar -xf - -C /var/www/html
  fi
}

case "$RESTORE_MODE" in
  compose)
    restore_postgres_via_compose
    restore_optional_wordpress_data
    ;;
  url)
    restore_postgres_via_url
    ;;
  *)
    echo "Unsupported RESTORE_MODE: $RESTORE_MODE"
    exit 1
    ;;
esac

run_post_restore_migrations() {
  if [[ ! -x "${MIGRATE_DB_SCRIPT}" ]]; then
    echo "Migration script not found or not executable: ${MIGRATE_DB_SCRIPT}"
    exit 1
  fi

  log "Running post-restore migrations"
  "${MIGRATE_DB_SCRIPT}" --env-file "${ENV_FILE}"
}

log "Restoring media assets"
mkdir -p data
for media_dir in product_images product_graphs product_pdfs series_graphs series_pdfs; do
  target_dir="data/${media_dir}"
  source_dir="${STAGING_DIR}/data/${media_dir}"
  echo "  ${media_dir}"
  rm -rf "${target_dir}"
  mkdir -p "${target_dir}"
  if [[ -d "${source_dir}" ]]; then
    cp -a "${source_dir}/." "${target_dir}/"
  fi
done

run_post_restore_migrations

log "Restore complete"
echo "Restore complete from:"
echo "  ${ARCHIVE_PATH}"
echo
if [[ "$RESTORE_MODE" == "compose" ]]; then
  echo "Next recommended step:"
  echo "  ${COMPOSE_BIN} ${COMPOSE_ARGS[*]} up -d"
fi
