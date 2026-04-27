#!/usr/bin/env bash
set -euo pipefail

podman build -t vent-tech-catalogue:latest -f Containerfile .

podman rm -f vent-tech-catalogue 2>/dev/null || true

podman run -d \
  --name vent-tech-catalogue \
  --env-file .env \
  -p 8004:8004 \
  vent-tech-catalogue:latest

echo "Vent-tech catalogue is running on http://localhost:8004"
