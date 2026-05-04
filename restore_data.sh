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

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <media-backup-zip-path>"
  exit 1
fi

ARCHIVE_PATH="$1"
if [[ ! -f "$ARCHIVE_PATH" ]]; then
  echo "Backup archive not found: $ARCHIVE_PATH"
  exit 1
fi

shift

ENV_FILE="${ENV_FILE:-.env.deploy}"
PODMAN_BIN="${PODMAN_BIN:-podman}"
APP_CONTAINER_NAME="${APP_CONTAINER_NAME:-fan-graphs-app}"
MEDIA_DIRS=(product_images product_graphs product_pdfs product_type_pdfs series_graphs series_pdfs)

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
      echo "Usage: $0 <media-backup-zip-path> [--sit|--deploy|--env-file <file>]"
      exit 1
      ;;
  esac
done

STAGING_DIR="$(mktemp -d)"
trap 'rm -rf "$STAGING_DIR"' EXIT

log "Extracting media archive"
python3 - <<'PY' "$ARCHIVE_PATH" "$STAGING_DIR"
import sys
import zipfile

archive_path = sys.argv[1]
target_dir = sys.argv[2]

with zipfile.ZipFile(archive_path, "r") as archive:
    archive.extractall(target_dir)
PY

restore_from_container() {
  if ! ${PODMAN_BIN} container exists "${APP_CONTAINER_NAME}" >/dev/null 2>&1; then
    echo "Deployment media restore requires the running ${APP_CONTAINER_NAME} container."
    exit 1
  fi

  local media_dirs=()
  local media_dir
  for media_dir in "${MEDIA_DIRS[@]}"; do
    if [[ -d "${STAGING_DIR}/data/${media_dir}" ]]; then
      media_dirs+=("data/${media_dir}")
    fi
  done

  if [[ -d "${STAGING_DIR}/templates" ]]; then
    media_dirs+=("templates")
  fi

  if [[ "${#media_dirs[@]}" -eq 0 ]]; then
    echo "No restorable media content found in ${ARCHIVE_PATH}."
    exit 1
  fi

  log "Restoring media into the running deployment container"
  ${PODMAN_BIN} exec -i "${APP_CONTAINER_NAME}" sh -lc 'rm -rf /app/data/product_images /app/data/product_graphs /app/data/product_pdfs /app/data/product_type_pdfs /app/data/series_graphs /app/data/series_pdfs /app/templates'
  tar -C "$STAGING_DIR" -cf - "${media_dirs[@]}" | ${PODMAN_BIN} exec -i "${APP_CONTAINER_NAME}" tar -C /app -xf -
}

restore_from_host() {
  log "Restoring media onto the host tree"
  mkdir -p data
  for media_dir in "${MEDIA_DIRS[@]}"; do
    target_dir="data/${media_dir}"
    source_dir="${STAGING_DIR}/data/${media_dir}"
    if [[ -d "${source_dir}" ]]; then
      rm -rf "${target_dir}"
      mkdir -p "${target_dir}"
      cp -a "${source_dir}/." "${target_dir}/"
    fi
  done

  if [[ -d "${STAGING_DIR}/templates" ]]; then
    rm -rf templates
    mkdir -p templates
    cp -a "${STAGING_DIR}/templates/." templates/
  fi
}

if [[ "${ENV_FILE}" == *.deploy ]]; then
  restore_from_container
else
  restore_from_host
fi

log "Media restore complete"
echo "Restore complete from:"
echo "  ${ARCHIVE_PATH}"
