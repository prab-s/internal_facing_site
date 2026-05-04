#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
echo "Warning: ./restore_data.sh is deprecated. Use ./restore_media_data.sh instead." >&2
exec "$(dirname "$0")/restore_media_data.sh" "$@"
