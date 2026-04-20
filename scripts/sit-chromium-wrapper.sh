#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
IMAGE="${SIT_CHROMIUM_IMAGE:-localhost/fan-graphs:latest}"
USER_DATA_DIR="$(mktemp -d /tmp/sit-chromium.XXXXXX)"

cleanup() {
  rm -rf "$USER_DATA_DIR"
}
trap cleanup EXIT

if ! command -v podman >/dev/null 2>&1; then
  echo "SIT PDF rendering requires podman when using the containerized Chromium fallback." >&2
  exit 1
fi

if ! podman image exists "$IMAGE"; then
  echo "SIT PDF rendering could not find the Chromium image: $IMAGE" >&2
  exit 1
fi

exec podman run --rm \
  --userns=keep-id \
  --user "$(id -u):$(id -g)" \
  -e "HOME=$USER_DATA_DIR" \
  -v /tmp:/tmp \
  -v "$PROJECT_ROOT:$PROJECT_ROOT" \
  "$IMAGE" \
  chromium \
  "--user-data-dir=$USER_DATA_DIR" \
  "$@"
