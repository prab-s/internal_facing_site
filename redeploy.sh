#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

ENV_FILE="${ENV_FILE:-.env.deploy}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

COMPOSE_FILE="${COMPOSE_FILE:-deploy-compose.yml}"
COMPOSE_BIN="${COMPOSE_BIN:-podman compose}"
HEALTH_URL="${HEALTH_URL:-https://p2.bitrep.nz/api/health}"
PUBLIC_HEALTH_URL="${PUBLIC_HEALTH_URL:-http://localhost:8004/}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-30}"
COMPOSE_ARGS=(-f "${COMPOSE_FILE}")
LEGACY_PUBLIC_SERVICE_NAME="${LEGACY_PUBLIC_SERVICE_NAME:-vent-tech-catalogue.service}"
LEGACY_PUBLIC_CONTAINER_NAME="${LEGACY_PUBLIC_CONTAINER_NAME:-vent-tech-catalogue}"

if [[ -n "${COMPOSE_PROFILES:-}" ]]; then
  IFS=',' read -r -a _compose_profiles <<< "${COMPOSE_PROFILES}"
  for profile in "${_compose_profiles[@]}"; do
    profile="${profile// /}"
    if [[ -n "$profile" ]]; then
      COMPOSE_ARGS+=(--profile "$profile")
    fi
  done
fi

fail_if_placeholder() {
  local name="$1"
  local value="$2"
  if [[ -z "$value" ]] || [[ "$value" == replace_with_* ]] || [[ "$value" == long_random_* ]]; then
    echo "Environment variable ${name} still looks like a placeholder in ${ENV_FILE}."
    exit 1
  fi
}

fail_if_placeholder "POSTGRES_PASSWORD" "${POSTGRES_PASSWORD:-}"
fail_if_placeholder "SESSION_SECRET" "${SESSION_SECRET:-}"
fail_if_placeholder "CMS_API_TOKEN" "${CMS_API_TOKEN:-}"

stop_legacy_public_service() {
  local systemctl_cmd=""
  local stop_failed=0

  if [[ "${EUID:-$(id -u)}" -eq 0 ]] && command -v systemctl >/dev/null 2>&1; then
    systemctl_cmd="systemctl"
  elif command -v sudo >/dev/null 2>&1; then
    systemctl_cmd="sudo systemctl"
  fi

  if [[ -n "$systemctl_cmd" ]] && $systemctl_cmd is-active --quiet "$LEGACY_PUBLIC_SERVICE_NAME" 2>/dev/null; then
    echo "Stopping legacy public service ${LEGACY_PUBLIC_SERVICE_NAME}..."
    if ! $systemctl_cmd stop "$LEGACY_PUBLIC_SERVICE_NAME"; then
      stop_failed=1
    fi
  fi

  podman rm -f "$LEGACY_PUBLIC_CONTAINER_NAME" 2>/dev/null || true

  if ss -ltn "( sport = :8004 )" 2>/dev/null | tail -n +2 | grep -q .; then
    echo
    echo "Port 8004 is still in use after trying to stop the legacy public service."
    if [[ "$stop_failed" -ne 0 ]]; then
      echo "The attempt to stop ${LEGACY_PUBLIC_SERVICE_NAME} failed."
    fi
    echo "Stop the old vent-tech-catalogue service first, then rerun redeploy.sh."
    exit 1
  fi
}

wait_for_url() {
  local url="$1"
  local label="$2"
  local timeout="$3"
  local elapsed=0

  echo "Waiting for ${label} at ${url} ..."
  until curl -sf "$url" >/dev/null; do
    sleep 1
    elapsed=$((elapsed + 1))
    if (( elapsed >= timeout )); then
      echo
      echo "${label} did not become ready within ${timeout}s."
      echo
      ${COMPOSE_BIN} "${COMPOSE_ARGS[@]}" ps || true
      echo
      echo "Recent app logs:"
      ${COMPOSE_BIN} "${COMPOSE_ARGS[@]}" logs --tail=80 app || true
      echo
      echo "Recent customer-facing logs:"
      ${COMPOSE_BIN} "${COMPOSE_ARGS[@]}" logs --tail=80 customer_facing || true
      exit 1
    fi
  done
}

stop_legacy_public_service

${COMPOSE_BIN} "${COMPOSE_ARGS[@]}" down --remove-orphans || true
${COMPOSE_BIN} "${COMPOSE_ARGS[@]}" build --no-cache
podman image prune -f >/dev/null 2>&1 || true
${COMPOSE_BIN} "${COMPOSE_ARGS[@]}" up -d

wait_for_url "${HEALTH_URL}" "Internal Facing API" "${HEALTH_TIMEOUT_SECONDS}"
wait_for_url "${PUBLIC_HEALTH_URL}" "Customer-facing site" "${HEALTH_TIMEOUT_SECONDS}"

echo
echo "internal-facing is up:"
echo "  https://p2.bitrep.nz"
echo "customer-facing is up:"
echo "  ${PUBLIC_HEALTH_URL}"
