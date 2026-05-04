#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
echo "Warning: ./backup_bundle.sh is deprecated. Use ./backup_db_data.sh instead." >&2
exec "$(dirname "$0")/backup_db_data.sh" "$@"
