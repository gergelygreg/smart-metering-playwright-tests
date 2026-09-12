#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
KUBECTL="${ROOT}/.tools/k8s/kubectl"
NS="smart-metering"

"${KUBECTL}" apply -f "${ROOT}/k8s/namespace.yaml"

"${KUBECTL}" \
  -n "${NS}" \
  create secret generic smart-metering-db \
  --from-literal=username="${POSTGRES_USER:-smart_metering}" \
  --from-literal=password="${POSTGRES_PASSWORD:-smart_metering}" \
  --dry-run=client \
  -o yaml |
"${KUBECTL}" apply -f -

echo "Validating Kustomize output..."
"${KUBECTL}" kustomize "${ROOT}/k8s/infrastructure" >/dev/null
"${KUBECTL}" kustomize "${ROOT}/k8s/apps" >/dev/null

echo "Deploying infrastructure..."
"${KUBECTL}" apply -k "${ROOT}/k8s/infrastructure"

# A retained kind cluster can contain a kafka-0 pod created from an older
# StatefulSet template. If the live pod still lacks the TCP readiness
# probe, replace only the pod; its PVC is preserved by the StatefulSet.
if "${KUBECTL}" -n "${NS}" get pod kafka-0 >/dev/null 2>&1; then
  live_readiness_port="$(
    "${KUBECTL}" \
      -n "${NS}" \
      get pod kafka-0 \
      -o jsonpath='{.spec.containers[?(@.name=="kafka")].readinessProbe.tcpSocket.port}' \
      2>/dev/null || true
  )"

  echo "Live kafka-0 readiness TCP port: ${live_readiness_port:-<none>}"

  if [[ "${live_readiness_port}" != "internal" ]]; then
    echo "Replacing stale kafka-0 so the new StatefulSet template is used..."

    "${KUBECTL}" \
      -n "${NS}" \
      delete pod kafka-0 \
      --wait=true \
      --timeout=120s
  fi
fi

"${KUBECTL}" -n "${NS}" rollout status deployment/mqtt-broker --timeout=180s
"${KUBECTL}" -n "${NS}" rollout status statefulset/postgres --timeout=240s

if ! "${KUBECTL}" -n "${NS}" rollout status statefulset/kafka --timeout=300s; then
  echo
  echo "=== Kafka rollout diagnostics ===" >&2
  "${KUBECTL}" -n "${NS}" get pod kafka-0 -o wide >&2 || true
  "${KUBECTL}" -n "${NS}" get pvc >&2 || true
  "${KUBECTL}" -n "${NS}" describe pod kafka-0 >&2 || true

  echo
  echo "=== Kafka current logs ===" >&2
  "${KUBECTL}" -n "${NS}" logs kafka-0 --all-containers=true --tail=500 >&2 || true

  echo
  echo "=== Kafka previous logs ===" >&2
  "${KUBECTL}" -n "${NS}" logs kafka-0 --all-containers=true --previous --tail=500 >&2 || true

  echo
  echo "=== Recent namespace events ===" >&2
  "${KUBECTL}" -n "${NS}" get events --sort-by=.lastTimestamp >&2 || true

  exit 1
fi

echo "Creating Kafka topics..."
"${KUBECTL}" -n "${NS}" delete job kafka-init --ignore-not-found=true --wait=true
"${KUBECTL}" apply -f "${ROOT}/k8s/jobs/kafka-init-job.yaml"
"${KUBECTL}" -n "${NS}" wait --for=condition=complete job/kafka-init --timeout=180s
"${KUBECTL}" -n "${NS}" logs job/kafka-init

echo "Deploying applications..."
"${KUBECTL}" apply -k "${ROOT}/k8s/apps"

for deployment in backend mqtt-ingestion kafka-event-service frontend; do
  "${KUBECTL}" \
    -n "${NS}" \
    rollout status "deployment/${deployment}" \
    --timeout=240s
done

echo
"${KUBECTL}" -n "${NS}" get pods -o wide
echo
"${KUBECTL}" -n "${NS}" get pvc
echo
"${KUBECTL}" -n "${NS}" get services
