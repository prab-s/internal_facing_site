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

PODMAN_BIN="${PODMAN_BIN:-podman}"
APP_DATA_VOLUME="${APP_DATA_VOLUME:-fan_graphs_app_data}"
APP_TEMPLATES_VOLUME="${APP_TEMPLATES_VOLUME:-fan_graphs_templates}"
SOURCE_DIR="${SOURCE_DIR:-data}"
ALPINE_IMAGE="${ALPINE_IMAGE:-docker.io/library/alpine:3.20}"
TEMPLATE_DIRS=(product series product_type registry.json)
MEDIA_DIRS=(product_images product_graphs product_pdfs product_type_pdfs series_graphs series_pdfs)

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Source data directory not found: $SOURCE_DIR"
  exit 1
fi

existing_dirs=()
for media_dir in "${MEDIA_DIRS[@]}"; do
  if [[ -d "${SOURCE_DIR}/${media_dir}" ]]; then
    existing_dirs+=("$media_dir")
  fi
done

template_source="${SOURCE_DIR%/}/../templates"
existing_templates=()
if [[ -d "$template_source" ]]; then
  for template_dir in "${TEMPLATE_DIRS[@]}"; do
    if [[ -e "${template_source}/${template_dir}" ]]; then
      existing_templates+=("$template_dir")
    fi
  done
fi

if [[ "${#existing_dirs[@]}" -eq 0 ]]; then
  echo "No data directories found in ${SOURCE_DIR}."
  exit 0
fi

log "Creating app data and template volumes if needed"
${PODMAN_BIN} volume create "${APP_DATA_VOLUME}" >/dev/null
${PODMAN_BIN} volume create "${APP_TEMPLATES_VOLUME}" >/dev/null

if ${PODMAN_BIN} run --rm -v "${APP_DATA_VOLUME}:/target:Z" "${ALPINE_IMAGE}" sh -lc 'find /target -mindepth 1 -maxdepth 1 -print -quit | grep -q .'; then
  echo "The volume ${APP_DATA_VOLUME} already contains files."
  echo "Refusing to overwrite it."
  exit 1
fi

if ${PODMAN_BIN} run --rm -v "${APP_TEMPLATES_VOLUME}:/target:Z" "${ALPINE_IMAGE}" sh -lc 'find /target -mindepth 1 -maxdepth 1 -print -quit | grep -q .'; then
  echo "The volume ${APP_TEMPLATES_VOLUME} already contains files."
  echo "Refusing to overwrite it."
  exit 1
fi

log "Copying media directories into ${APP_DATA_VOLUME}"
tar -C "$SOURCE_DIR" -cf - "${existing_dirs[@]}" | ${PODMAN_BIN} run --rm -i -v "${APP_DATA_VOLUME}:/target:Z" "${ALPINE_IMAGE}" tar -xf - -C /target

if [[ "${#existing_templates[@]}" -gt 0 ]]; then
  log "Copying templates into ${APP_TEMPLATES_VOLUME}"
  tar -C "$template_source" -cf - "${existing_templates[@]}" | ${PODMAN_BIN} run --rm -i -v "${APP_TEMPLATES_VOLUME}:/target:Z" "${ALPINE_IMAGE}" tar -xf - -C /target
fi

log "Migration complete"
echo "Copied directories:"
for media_dir in "${existing_dirs[@]}"; do
  echo "  ${media_dir}"
done
if [[ "${#existing_templates[@]}" -gt 0 ]]; then
  echo "Copied templates:"
  for template_dir in "${existing_templates[@]}"; do
    echo "  ${template_dir}"
  done
fi
