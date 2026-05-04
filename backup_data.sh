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

ENV_FILE="${ENV_FILE:-.env.deploy}"
OUTPUT_DIR="${OUTPUT_DIR:-data/backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
ARCHIVE_NAME="${ARCHIVE_NAME:-fan_graphs_data_backup_${TIMESTAMP}.zip}"
PODMAN_BIN="${PODMAN_BIN:-podman}"
APP_CONTAINER_NAME="${APP_CONTAINER_NAME:-fan-graphs-app}"
MEDIA_DIRS=(product_images product_graphs product_pdfs product_type_pdfs series_graphs series_pdfs)
TEMPLATE_DIRS=(product series product_type registry.json)

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
    *)
      echo "Unknown argument: $1"
      echo "Usage: $0 [--sit|--deploy|--env-file <file>] [--output-dir <dir>] [--archive-name <file>]"
      exit 1
      ;;
  esac
done

mkdir -p "$OUTPUT_DIR"
STAGING_DIR="$(mktemp -d)"
trap 'rm -rf "$STAGING_DIR"' EXIT

source_data_from_container() {
  local existing_paths=()
  local media_dir

  for media_dir in "${MEDIA_DIRS[@]}"; do
    if ${PODMAN_BIN} exec "${APP_CONTAINER_NAME}" test -d "/app/data/${media_dir}" >/dev/null 2>&1; then
      existing_paths+=("data/${media_dir}")
    fi
  done

  if ${PODMAN_BIN} exec "${APP_CONTAINER_NAME}" test -d "/app/templates" >/dev/null 2>&1; then
    existing_paths+=("templates")
  fi

  if [[ "${#existing_paths[@]}" -eq 0 ]]; then
    return 0
  fi

  mkdir -p "${STAGING_DIR}/data"
  ${PODMAN_BIN} exec -i "${APP_CONTAINER_NAME}" tar -C /app -cf - "${existing_paths[@]}" | tar -xf - -C "$STAGING_DIR"
}

source_data_from_host() {
  local media_dir
  mkdir -p "${STAGING_DIR}/data"
  for media_dir in "${MEDIA_DIRS[@]}"; do
    if [[ -d "data/${media_dir}" ]]; then
      cp -a "data/${media_dir}" "${STAGING_DIR}/data/${media_dir}"
    fi
  done

  if [[ -d "templates" ]]; then
    mkdir -p "${STAGING_DIR}/templates"
    for template_dir in "${TEMPLATE_DIRS[@]}"; do
      if [[ -e "templates/${template_dir}" ]]; then
        cp -a "templates/${template_dir}" "${STAGING_DIR}/templates/${template_dir}"
      fi
    done
  fi
}

log "Collecting media assets"
if [[ "${ENV_FILE}" == *.deploy ]]; then
  if ! ${PODMAN_BIN} container exists "${APP_CONTAINER_NAME}" >/dev/null 2>&1; then
    echo "Deployment media backup requires the running ${APP_CONTAINER_NAME} container."
    exit 1
  fi
  source_data_from_container
else
  source_data_from_host
fi

cat > "$STAGING_DIR/README.txt" <<EOF
Internal Facing media data backup archive
Generated: ${TIMESTAMP}
Env file: ${ENV_FILE}

Contents:
- data/product_images : uploaded product images (if present)
- data/product_graphs : generated graph images (if present)
- data/product_pdfs : generated product PDF assets (if present)
- data/product_type_pdfs : generated product type PDF assets (if present)
- data/series_graphs : generated series graph images (if present)
- data/series_pdfs : generated series PDF assets (if present)
- templates : template folders and registry (if present)
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

log "Backup written"
echo "Backup written to:"
echo "  ${OUTPUT_DIR}/${ARCHIVE_NAME}"
