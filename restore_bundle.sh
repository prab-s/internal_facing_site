#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

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

RESTORE_MODE="${RESTORE_MODE:-${RESTORE_MODE:-auto}}"
if [[ "$RESTORE_MODE" == "auto" ]]; then
  if [[ "${DATABASE_URL:-}" == *"@postgres:"* ]]; then
    RESTORE_MODE="compose"
  else
    RESTORE_MODE="url"
  fi
fi

restore_postgres_via_compose() {
  ${COMPOSE_BIN} "${COMPOSE_ARGS[@]}" up -d postgres

  ${COMPOSE_BIN} "${COMPOSE_ARGS[@]}" exec -T postgres psql \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" \
    -v ON_ERROR_STOP=1 \
    -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO ${POSTGRES_USER}; GRANT ALL ON SCHEMA public TO public;"

  ${COMPOSE_BIN} "${COMPOSE_ARGS[@]}" exec -T postgres psql \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" \
    -v ON_ERROR_STOP=1 < "${DB_DUMP_PATH}"
}

restore_postgres_via_url() {
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "DATABASE_URL is required for URL-mode restore."
    exit 1
  fi

  podman run --rm --network host \
    -e DATABASE_URL="${DATABASE_URL}" \
    "${PG_CLIENT_IMAGE}" \
    sh -lc 'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO CURRENT_USER; GRANT ALL ON SCHEMA public TO public;"'

  podman run --rm --network host -i \
    -e DATABASE_URL="${DATABASE_URL}" \
    "${PG_CLIENT_IMAGE}" \
    sh -lc 'psql "$DATABASE_URL" -v ON_ERROR_STOP=1' < "${DB_DUMP_PATH}"
}

restore_optional_wordpress_data() {
  local wordpress_dump_path="${STAGING_DIR}/wordpress_dump.sql"
  local wordpress_content_tar="${STAGING_DIR}/wordpress/wp-content.tar"

  if [[ ! -f "${wordpress_dump_path}" ]] && [[ ! -f "${wordpress_content_tar}" ]]; then
    return 0
  fi

  ${COMPOSE_BIN} "${COMPOSE_ARGS[@]}" up -d wordpress_db wordpress

  if [[ -f "${wordpress_dump_path}" ]]; then
    ${COMPOSE_BIN} "${COMPOSE_ARGS[@]}" exec -T wordpress_db mariadb \
      -u root \
      "-p${WORDPRESS_DB_ROOT_PASSWORD}" \
      -e "DROP DATABASE IF EXISTS \`${WORDPRESS_DB_NAME}\`; CREATE DATABASE \`${WORDPRESS_DB_NAME}\`; GRANT ALL PRIVILEGES ON \`${WORDPRESS_DB_NAME}\`.* TO '${WORDPRESS_DB_USER}'@'%'; FLUSH PRIVILEGES;"

    ${COMPOSE_BIN} "${COMPOSE_ARGS[@]}" exec -T wordpress_db mariadb \
      -u root \
      "-p${WORDPRESS_DB_ROOT_PASSWORD}" \
      "${WORDPRESS_DB_NAME}" < "${wordpress_dump_path}"
  fi

  if [[ -f "${wordpress_content_tar}" ]]; then
    ${COMPOSE_BIN} "${COMPOSE_ARGS[@]}" exec -T wordpress sh -lc 'rm -rf /var/www/html/wp-content && mkdir -p /var/www/html'
    ${COMPOSE_BIN} "${COMPOSE_ARGS[@]}" exec -T wordpress tar -xf - -C /var/www/html < "${wordpress_content_tar}"
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

mkdir -p data
for media_dir in product_images product_graphs product_pdfs; do
  target_dir="data/${media_dir}"
  source_dir="${STAGING_DIR}/data/${media_dir}"
  rm -rf "${target_dir}"
  mkdir -p "${target_dir}"
  if [[ -d "${source_dir}" ]]; then
    cp -a "${source_dir}/." "${target_dir}/"
  fi
done

echo
echo "Restore complete from:"
echo "  ${ARCHIVE_PATH}"
echo
if [[ "$RESTORE_MODE" == "compose" ]]; then
  echo "Next recommended step:"
  echo "  ${COMPOSE_BIN} ${COMPOSE_ARGS[*]} up -d"
fi
