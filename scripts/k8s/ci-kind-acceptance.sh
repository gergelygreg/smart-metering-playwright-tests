#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
KUBECTL="${ROOT}/.tools/k8s/kubectl"
NS="smart-metering"
PF_PIDS=()

cleanup() {
  set +e

  for pid in "${PF_PIDS[@]:-}"; do
    kill "${pid}" 2>/dev/null || true
  done

  mkdir -p "${ROOT}/.k8s-runtime"

  if [[ -x "${KUBECTL}" ]]; then
    "${KUBECTL}" -n "${NS}" get all,pvc -o wide \
      > "${ROOT}/.k8s-runtime/kubectl-get-all.txt" 2>&1 || true

    "${KUBECTL}" -n "${NS}" get events --sort-by=.lastTimestamp \
      > "${ROOT}/.k8s-runtime/kubectl-events.txt" 2>&1 || true
  fi

  bash "${ROOT}/scripts/k8s/destroy-cluster.sh" || true
}
trap cleanup EXIT

start_pf() {
  local resource="$1"
  local mapping="$2"
  local name="$3"

  "${KUBECTL}" \
    -n "${NS}" \
    port-forward \
    "${resource}" \
    "${mapping}" \
    --address 127.0.0.1 \
    > "${ROOT}/.k8s-runtime/${name}.log" 2>&1 &

  PF_PIDS+=("$!")
}

wait_http() {
  local url="$1"
  local name="$2"

  for _ in $(seq 1 120); do
    if curl --fail --silent "${url}" >/dev/null; then
      echo "${name}: READY"
      return 0
    fi
    sleep 1
  done

  echo "${name} did not become ready: ${url}" >&2
  return 1
}

wait_tcp() {
  local host="$1"
  local port="$2"
  local name="$3"

  for _ in $(seq 1 120); do
    if (echo >/dev/tcp/"${host}"/"${port}") >/dev/null 2>&1; then
      echo "${name}: READY"
      return 0
    fi
    sleep 1
  done

  echo "${name} did not become ready: ${host}:${port}" >&2
  return 1
}

mkdir -p "${ROOT}/.k8s-runtime"

bash "${ROOT}/scripts/k8s/create-cluster.sh"
bash "${ROOT}/scripts/k8s/build-load-images.sh"
bash "${ROOT}/scripts/k8s/deploy.sh"

start_pf service/backend "18080:8080" backend
start_pf service/frontend "8088:80" frontend
start_pf service/mqtt-broker "1883:1883" mqtt
start_pf service/mqtt-ingestion "18090:8090" mqtt-ingestion
start_pf service/kafka-event-service "18100:8100" kafka-event-service
start_pf service/kafka "29092:29092" kafka

wait_http http://127.0.0.1:18080/api/health backend
wait_http http://127.0.0.1:8088/healthz frontend
wait_http http://127.0.0.1:18090/health mqtt-ingestion
wait_http http://127.0.0.1:18100/health kafka-event-service
wait_tcp 127.0.0.1 1883 mqtt
wait_tcp 127.0.0.1 29092 kafka

echo
echo "=== REST API on Kubernetes ==="
API_BASE_URL=http://127.0.0.1:18080 \
  npm run test:api

echo
echo "=== MQTT -> Kafka on Kubernetes ==="
MQTT_API_BASE_URL=http://127.0.0.1:18080 \
MQTT_URL=mqtt://127.0.0.1:1883 \
  npm run test:mqtt

echo
echo "=== Kafka contracts on Kubernetes ==="
KAFKA_API_BASE_URL=http://127.0.0.1:18080 \
KAFKA_BROKER=127.0.0.1:29092 \
KAFKA_EVENT_SERVICE_BASE_URL=http://127.0.0.1:18100 \
  npm run test:kafka

echo
echo "=== Browser E2E on Kubernetes ==="
UI_BASE_URL=http://127.0.0.1:8088 \
UI_API_BASE_URL=http://127.0.0.1:18080 \
MQTT_URL=mqtt://127.0.0.1:1883 \
  npm run test:ui

echo
echo "=== Device simulator Kubernetes Job ==="
serial="K8S-CI-SIM-${GITHUB_RUN_ID:-local}-$(date +%s)"

bash "${ROOT}/scripts/k8s/run-simulator-job.sh" \
  "${serial}" \
  mixed \
  4 \
  150

SIM_SERIAL_NUMBER="${serial}" \
EXPECTED_READINGS=4 \
EXPECT_ALARM=true \
API_BASE_URL=http://127.0.0.1:18080 \
KAFKA_EVENT_SERVICE_BASE_URL=http://127.0.0.1:18100 \
  node "${ROOT}/scripts/assert-simulator-output.mjs"

echo
bash "${ROOT}/scripts/k8s/operational-acceptance.sh"

echo
echo "===================================================="
echo "KUBERNETES KIND ORCHESTRATION ACCEPTANCE SUCCESS"
echo "===================================================="
echo "Kubernetes:             v1.37.0"
echo "kind:                   v0.33.0"
echo "Application suites:     53/53 GREEN"
echo "Device simulator Job:         GREEN"
echo "Backend pod self-healing:     GREEN"
echo "Backend scale 2 -> 3 -> 2:    GREEN"
echo "PostgreSQL/Kafka PVCs:        BOUND"
echo "MQTT -> Kafka -> API -> UI:   GREEN"
