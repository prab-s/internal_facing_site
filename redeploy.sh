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
COMPOSE_VERBOSE_ARGS=(--verbose --no-ansi)
HEALTH_URL="${HEALTH_URL:-https://p2.bitrep.nz/api/health}"
PUBLIC_HEALTH_URL="${PUBLIC_HEALTH_URL:-http://localhost:8004/}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-30}"
COMPOSE_MONITOR_INTERVAL_SECONDS="${COMPOSE_MONITOR_INTERVAL_SECONDS:-5}"
PODMAN_BIN="${PODMAN_BIN:-podman}"
APP_DATA_VOLUME="${APP_DATA_VOLUME:-fan_graphs_app_data}"
ALPINE_IMAGE="${ALPINE_IMAGE:-docker.io/library/alpine:3.20}"
COMPOSE_ARGS=(-f "${COMPOSE_FILE}")
LEGACY_PUBLIC_SERVICE_NAME="${LEGACY_PUBLIC_SERVICE_NAME:-vent-tech-catalogue.service}"
LEGACY_PUBLIC_CONTAINER_NAME="${LEGACY_PUBLIC_CONTAINER_NAME:-vent-tech-catalogue}"

timestamp() {
  date +"%Y-%m-%d %H:%M:%S"
}

log_step() {
  echo
  echo "[$(timestamp)] ==> $1"
}

log_step_done() {
  echo "[$(timestamp)]     done"
}

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

seed_app_data_volume_if_needed() {
  local source_has_data=0
  local data_dir
  for data_dir in data/product_images data/product_graphs data/product_pdfs data/product_type_pdfs data/series_graphs data/series_pdfs data/backups; do
    if [[ -d "$data_dir" ]]; then
      source_has_data=1
      break
    fi
  done

  if [[ "$source_has_data" -eq 0 ]]; then
    return 0
  fi

  if ${PODMAN_BIN} volume inspect "${APP_DATA_VOLUME}" >/dev/null 2>&1; then
    if ${PODMAN_BIN} run --rm -v "${APP_DATA_VOLUME}:/target:Z" "${ALPINE_IMAGE}" sh -lc 'find /target -mindepth 1 -maxdepth 1 -print -quit | grep -q .'; then
      return 0
    fi
  fi

  if [[ -x ./migrate_prod_data_volume.sh ]]; then
    echo "[$(timestamp)] Seeding the PROD app data volume from the existing host data tree..."
    ./migrate_prod_data_volume.sh
  fi
}

stop_legacy_public_service() {
  local systemctl_cmd=""
  local stop_failed=0

  if [[ "${EUID:-$(id -u)}" -eq 0 ]] && command -v systemctl >/dev/null 2>&1; then
    systemctl_cmd="systemctl"
  elif command -v sudo >/dev/null 2>&1; then
    systemctl_cmd="sudo systemctl"
  fi

  if [[ -n "$systemctl_cmd" ]] && $systemctl_cmd is-active --quiet "$LEGACY_PUBLIC_SERVICE_NAME" 2>/dev/null; then
    echo "[$(timestamp)] Stopping legacy public service ${LEGACY_PUBLIC_SERVICE_NAME}..."
    if ! $systemctl_cmd stop "$LEGACY_PUBLIC_SERVICE_NAME"; then
      stop_failed=1
    fi
  fi

  if ${PODMAN_BIN} container exists "$LEGACY_PUBLIC_CONTAINER_NAME" >/dev/null 2>&1; then
    echo "[$(timestamp)] Removing legacy public container ${LEGACY_PUBLIC_CONTAINER_NAME}..."
    ${PODMAN_BIN} rm -f "$LEGACY_PUBLIC_CONTAINER_NAME" >/dev/null 2>&1 || true
  fi

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

  echo "[$(timestamp)] Waiting for ${label} at ${url} ..."
  until curl -sf "$url" >/dev/null; do
    sleep 1
    elapsed=$((elapsed + 1))
    if (( elapsed % 5 == 0 )); then
      echo "[$(timestamp)]   still waiting after ${elapsed}s..."
    fi
    if (( elapsed >= timeout )); then
      echo
      echo "[$(timestamp)] ${label} did not become ready within ${timeout}s."
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

log_container_snapshot() {
  local label="$1"
  echo "[$(timestamp)] ${label}"
  ${PODMAN_BIN} ps -a --filter name=fan-graphs --filter name=vent-tech-catalogue --filter name=postgres --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' || true
  for container_name in fan-graphs-postgres fan-graphs-app vent-tech-catalogue; do
    if ${PODMAN_BIN} container exists "$container_name" >/dev/null 2>&1; then
      ${PODMAN_BIN} inspect --format "[$(timestamp)] {{.Name}} state={{.State.Status}} exit={{.State.ExitCode}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}n/a{{end}}" "$container_name" || true
    fi
  done
}

COMPOSE_MONITOR_STOP_FILE=""
COMPOSE_MONITOR_PID=""
COMPOSE_LOG_FOLLOW_PIDS=()

start_log_follower() {
  local container_name="$1"
  local stop_file="$2"
  (
    while [[ ! -f "$stop_file" ]]; do
      if ${PODMAN_BIN} container exists "$container_name" >/dev/null 2>&1; then
        echo "[$(timestamp)] Following logs for ${container_name}"
        ${PODMAN_BIN} logs --since=0 --follow "$container_name" || true
        break
      fi
      sleep 1
    done
  ) &
  COMPOSE_LOG_FOLLOW_PIDS+=($!)
}

start_compose_monitor() {
  COMPOSE_MONITOR_STOP_FILE="$(mktemp)"
  start_log_follower fan-graphs-postgres "$COMPOSE_MONITOR_STOP_FILE"
  start_log_follower fan-graphs-app "$COMPOSE_MONITOR_STOP_FILE"
  start_log_follower vent-tech-catalogue "$COMPOSE_MONITOR_STOP_FILE"
  (
    while [[ ! -f "$COMPOSE_MONITOR_STOP_FILE" ]]; do
      echo "[$(timestamp)] compose monitor snapshot"
      log_container_snapshot "Current containers"
      sleep "${COMPOSE_MONITOR_INTERVAL_SECONDS}"
    done
  ) &
  COMPOSE_MONITOR_PID=$!
}

stop_compose_monitor() {
  if [[ -n "$COMPOSE_MONITOR_STOP_FILE" ]]; then
    touch "$COMPOSE_MONITOR_STOP_FILE"
  fi
  for pid in "${COMPOSE_LOG_FOLLOW_PIDS[@]:-}"; do
    wait "$pid" 2>/dev/null || true
  done
  COMPOSE_LOG_FOLLOW_PIDS=()
  if [[ -n "$COMPOSE_MONITOR_PID" ]]; then
    wait "$COMPOSE_MONITOR_PID" 2>/dev/null || true
  fi
  if [[ -n "$COMPOSE_MONITOR_STOP_FILE" ]]; then
    rm -f "$COMPOSE_MONITOR_STOP_FILE"
  fi
  COMPOSE_MONITOR_STOP_FILE=""
  COMPOSE_MONITOR_PID=""
}

cleanup() {
  stop_compose_monitor
}

trap cleanup EXIT

compose_build_with_retry() {
  local attempt=1
  local max_attempts=2

  while (( attempt <= max_attempts )); do
    if ${COMPOSE_BIN} "${COMPOSE_ARGS[@]}" "${COMPOSE_VERBOSE_ARGS[@]}" build --no-cache; then
      return 0
    fi

    if (( attempt == max_attempts )); then
      return 1
    fi

    echo
    echo "[$(timestamp)] Build attempt ${attempt} failed; retrying in 5 seconds..."
    sleep 5
    attempt=$((attempt + 1))
  done
}

remove_if_exists() {
  local container_name="$1"
  if ${PODMAN_BIN} container exists "$container_name" >/dev/null 2>&1; then
    echo "[$(timestamp)] Removing existing container ${container_name}..."
    ${PODMAN_BIN} rm -f "$container_name" >/dev/null 2>&1 || true
  fi
}

echo "[$(timestamp)] Starting redeploy"
stop_legacy_public_service
log_step "Checking whether the app data volume needs seeding"
seed_app_data_volume_if_needed
log_step_done

log_step "Removing any existing app containers"
remove_if_exists vent-tech-catalogue
remove_if_exists fan-graphs-app
remove_if_exists fan-graphs-postgres
log_step_done

log_step "Bringing the old compose stack down"
${COMPOSE_BIN} "${COMPOSE_ARGS[@]}" "${COMPOSE_VERBOSE_ARGS[@]}" down --remove-orphans || true
log_step_done

log_step "Building images with compose"
compose_build_with_retry
log_step_done

log_step "Pruning dangling images"
podman image prune -f >/dev/null 2>&1 || true
log_step_done

log_step "Starting the new stack"
start_compose_monitor
if ${COMPOSE_BIN} "${COMPOSE_ARGS[@]}" "${COMPOSE_VERBOSE_ARGS[@]}" up -d --force-recreate; then
  compose_up_exit_code=0
else
  compose_up_exit_code=$?
fi
stop_compose_monitor
if [[ "${compose_up_exit_code:-0}" -ne 0 ]]; then
  echo "[$(timestamp)] Compose up failed with exit code ${compose_up_exit_code}."
  exit "${compose_up_exit_code}"
fi
log_step_done
log_container_snapshot "Container snapshot after compose up"

log_step "Waiting for the internal API to become healthy"
wait_for_url "${HEALTH_URL}" "Internal Facing API" "${HEALTH_TIMEOUT_SECONDS}"
log_step_done

log_step "Waiting for the customer-facing site to become healthy"
wait_for_url "${PUBLIC_HEALTH_URL}" "Customer-facing site" "${HEALTH_TIMEOUT_SECONDS}"
log_step_done

echo
echo "internal-facing is up:"
echo "  https://p2.bitrep.nz"
echo "customer-facing is up:"
echo "  ${PUBLIC_HEALTH_URL}"
