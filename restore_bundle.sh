#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
echo "Warning: ./restore_bundle.sh is deprecated. Use ./restore_db_data.sh instead." >&2
exec "$(dirname "$0")/restore_db_data.sh" "$@"
