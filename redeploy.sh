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
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8000/api/health}"
WORDPRESS_URL="${WORDPRESS_URL:-http://127.0.0.1:${WORDPRESS_PORT:-8003}}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-30}"
COMPOSE_ARGS=(-f "${COMPOSE_FILE}")

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
  if [[ -z "$value" ]] || [[ "$value" == replace_with_* ]] || [[ "$value" == long_random_* ]] || [[ "$value" == wordpress_*_VT_customer_site ]] || [[ "$value" == wordpress_db_password_* ]] || [[ "$value" == wordpress_root_password_* ]]; then
    echo "Environment variable ${name} still looks like a placeholder in ${ENV_FILE}."
    exit 1
  fi
}

fail_if_placeholder "POSTGRES_PASSWORD" "${POSTGRES_PASSWORD:-}"
fail_if_placeholder "SESSION_SECRET" "${SESSION_SECRET:-}"
fail_if_placeholder "CMS_API_TOKEN" "${CMS_API_TOKEN:-}"
fail_if_placeholder "WORDPRESS_DB_PASSWORD" "${WORDPRESS_DB_PASSWORD:-}"
fail_if_placeholder "WORDPRESS_DB_ROOT_PASSWORD" "${WORDPRESS_DB_ROOT_PASSWORD:-}"

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
      if [[ "${COMPOSE_PROFILES:-}" == *wordpress* ]]; then
        echo
        echo "Recent wordpress logs:"
        ${COMPOSE_BIN} "${COMPOSE_ARGS[@]}" logs --tail=80 wordpress || true
      fi
      exit 1
    fi
  done
}

${COMPOSE_BIN} "${COMPOSE_ARGS[@]}" down --remove-orphans || true
${COMPOSE_BIN} "${COMPOSE_ARGS[@]}" build --no-cache
podman image prune -f >/dev/null 2>&1 || true
${COMPOSE_BIN} "${COMPOSE_ARGS[@]}" up -d

wait_for_url "${HEALTH_URL}" "Internal Facing API" "${HEALTH_TIMEOUT_SECONDS}"

if [[ "${COMPOSE_PROFILES:-}" == *wordpress* ]]; then
  wait_for_url "${WORDPRESS_URL}" "WordPress" "${HEALTH_TIMEOUT_SECONDS}"
fi

echo
echo "internal-facing is up:"
echo "  http://127.0.0.1:8000"
if [[ "${COMPOSE_PROFILES:-}" == *wordpress* ]]; then
  echo "  http://127.0.0.1:${WORDPRESS_PORT:-8003} (WordPress)"
fi
