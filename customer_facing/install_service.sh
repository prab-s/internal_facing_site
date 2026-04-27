#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="vent-tech-catalogue"
IMAGE_NAME="vent-tech-catalogue:latest"
ENV_DIR="/etc/vent-tech-catalogue"
ENV_FILE="${ENV_DIR}/${SERVICE_NAME}.env"
SYSTEMD_UNIT="/etc/systemd/system/${SERVICE_NAME}.service"
TEMPLATE_FILE="${ROOT_DIR}/${SERVICE_NAME}.service.template"
EXAMPLE_ENV_FILE="${ROOT_DIR}/${SERVICE_NAME}.env.example"
LOCAL_ENV_FILE="${ROOT_DIR}/.env"

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Please run this script as root or with sudo."
  exit 1
fi

if ! command -v podman >/dev/null 2>&1; then
  echo "podman is required but was not found in PATH."
  exit 1
fi

if [[ ! -f "$TEMPLATE_FILE" ]]; then
  echo "Missing service template: $TEMPLATE_FILE"
  exit 1
fi

if [[ ! -f "$EXAMPLE_ENV_FILE" ]]; then
  echo "Missing example env file: $EXAMPLE_ENV_FILE"
  exit 1
fi

install -d -m 0755 "$ENV_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f "$LOCAL_ENV_FILE" ]]; then
    install -m 0600 "$LOCAL_ENV_FILE" "$ENV_FILE"
    echo "Copied local environment file to $ENV_FILE"
  else
    install -m 0600 "$EXAMPLE_ENV_FILE" "$ENV_FILE"
    echo "Created default environment file at $ENV_FILE"
  fi
else
  echo "Keeping existing environment file at $ENV_FILE"
fi

sed \
  -e "s|__ROOT_DIR__|$ROOT_DIR|g" \
  -e "s|__ENV_FILE__|$ENV_FILE|g" \
  -e "s|__IMAGE_NAME__|$IMAGE_NAME|g" \
  "$TEMPLATE_FILE" > "$SYSTEMD_UNIT"

systemctl daemon-reload
systemctl enable --now "${SERVICE_NAME}.service"

echo "Installed and started ${SERVICE_NAME}.service"
echo "Container image: ${IMAGE_NAME}"
echo "Environment file: ${ENV_FILE}"

if ! grep -Eq '^CMS_API_TOKEN=.+$' "$ENV_FILE"; then
  echo "Warning: CMS_API_TOKEN is empty in $ENV_FILE."
  echo "The site will start, but catalogue requests may fail until the token is set."
fi
