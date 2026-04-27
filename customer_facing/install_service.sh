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
REFRESH_ONLY=false

if [[ "${1:-}" == "--refresh-only" ]]; then
  REFRESH_ONLY=true
fi

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

merge_env_file() {
  local source_file="$1"
  local target_file="$2"
  python3 - "$source_file" "$target_file" <<'PY'
from pathlib import Path
import sys

source_path = Path(sys.argv[1])
target_path = Path(sys.argv[2])

def parse_env(path: Path):
    data = {}
    if not path.exists():
        return data
    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        data[key.strip()] = value
    return data

source = parse_env(source_path)
target = parse_env(target_path)

preserve_keys = {"CMS_API_TOKEN"}
merged = dict(target)
for key, value in source.items():
    merged[key] = value

for key in preserve_keys:
    if key in target and key not in source:
        merged[key] = target[key]

lines = [f"{key}={value}" for key, value in merged.items()]
target_path.write_text("\n".join(lines) + "\n")
PY
}

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

if [[ "$REFRESH_ONLY" == true && -f "$LOCAL_ENV_FILE" ]]; then
  merge_env_file "$LOCAL_ENV_FILE" "$ENV_FILE"
  echo "Merged refreshed local environment defaults into $ENV_FILE"
fi

sed \
  -e "s|__ROOT_DIR__|$ROOT_DIR|g" \
  -e "s|__ENV_FILE__|$ENV_FILE|g" \
  -e "s|__IMAGE_NAME__|$IMAGE_NAME|g" \
  "$TEMPLATE_FILE" > "$SYSTEMD_UNIT"

systemctl daemon-reload

if [[ "$REFRESH_ONLY" == false ]]; then
  systemctl enable --now "${SERVICE_NAME}.service"
fi

if [[ "$REFRESH_ONLY" == true ]]; then
  echo "Refreshed ${SERVICE_NAME}.service"
else
  echo "Installed and started ${SERVICE_NAME}.service"
fi
echo "Container image: ${IMAGE_NAME}"
echo "Environment file: ${ENV_FILE}"

if ! grep -Eq '^CMS_API_TOKEN=.+$' "$ENV_FILE"; then
  echo "Warning: CMS_API_TOKEN is empty in $ENV_FILE."
  echo "The site will start, but catalogue requests may fail until the token is set."
fi
