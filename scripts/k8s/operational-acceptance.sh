#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
KUBECTL="${ROOT}/.tools/k8s/kubectl"
NS="smart-metering"

echo "=== Kubernetes pod self-healing ==="

pod="$(
  "${KUBECTL}" \
    -n "${NS}" \
    get pod \
    -l app.kubernetes.io/name=backend \
    -o jsonpath='{.items[0].metadata.name}'
)"

"${KUBECTL}" -n "${NS}" delete pod "${pod}" --wait=false

"${KUBECTL}" \
  -n "${NS}" \
  rollout status deployment/backend \
  --timeout=180s

desired="$(
  "${KUBECTL}" \
    -n "${NS}" \
    get deployment backend \
    -o jsonpath='{.spec.replicas}'
)"

ready="$(
  "${KUBECTL}" \
    -n "${NS}" \
    get deployment backend \
    -o jsonpath='{.status.readyReplicas}'
)"

if [[ "${ready}" != "${desired}" ]]; then
  echo "Backend replacement readiness mismatch: desired=${desired}, ready=${ready}" >&2
  exit 1
fi

echo "Backend pod replacement: GREEN (${ready}/${desired} Ready)"

echo
echo "=== Kubernetes scaling ==="

"${KUBECTL}" -n "${NS}" scale deployment/backend --replicas=3
"${KUBECTL}" -n "${NS}" rollout status deployment/backend --timeout=180s

ready="$(
  "${KUBECTL}" \
    -n "${NS}" \
    get deployment backend \
    -o jsonpath='{.status.readyReplicas}'
)"

test "${ready}" = "3"

"${KUBECTL}" -n "${NS}" scale deployment/backend --replicas=2
"${KUBECTL}" -n "${NS}" rollout status deployment/backend --timeout=180s

echo "Backend scale 2 -> 3 -> 2: GREEN"

echo
echo "=== PVC acceptance ==="

"${KUBECTL}" -n "${NS}" get pvc

unbound="$(
  "${KUBECTL}" \
    -n "${NS}" \
    get pvc \
    --no-headers |
  awk '$2 != "Bound" {print $1}'
)"

if [[ -n "${unbound}" ]]; then
  echo "Unbound PVCs:" >&2
  echo "${unbound}" >&2
  exit 1
fi

echo "PersistentVolumeClaims: BOUND"
