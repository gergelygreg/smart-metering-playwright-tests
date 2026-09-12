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

desired="$(
  "${KUBECTL}" \
    -n "${NS}" \
    get deployment backend \
    -o jsonpath='{.spec.replicas}'
)"

echo "Deleting backend pod: ${pod}"
echo "Desired backend replicas: ${desired}"

"${KUBECTL}" \
  -n "${NS}" \
  delete pod "${pod}" \
  --wait=true \
  --timeout=120s

self_healing_ready=0

for attempt in $(seq 1 90); do
  current="$(
    "${KUBECTL}" \
      -n "${NS}" \
      get deployment backend \
      -o jsonpath='{.status.replicas}' \
      2>/dev/null || true
  )"

  ready="$(
    "${KUBECTL}" \
      -n "${NS}" \
      get deployment backend \
      -o jsonpath='{.status.readyReplicas}' \
      2>/dev/null || true
  )"

  available="$(
    "${KUBECTL}" \
      -n "${NS}" \
      get deployment backend \
      -o jsonpath='{.status.availableReplicas}' \
      2>/dev/null || true
  )"

  current="${current:-0}"
  ready="${ready:-0}"
  available="${available:-0}"

  old_pod_exists=0

  if "${KUBECTL}" \
    -n "${NS}" \
    get pod "${pod}" \
    >/dev/null 2>&1
  then
    old_pod_exists=1
  fi

  echo "Self-healing attempt ${attempt}: desired=${desired}, current=${current}, ready=${ready}, available=${available}, oldPodExists=${old_pod_exists}"

  if [[ "${old_pod_exists}" == "0" ]] &&
     [[ "${current}" == "${desired}" ]] &&
     [[ "${ready}" == "${desired}" ]] &&
     [[ "${available}" == "${desired}" ]]
  then
    self_healing_ready=1
    break
  fi

  sleep 2
done

if [[ "${self_healing_ready}" != "1" ]]; then
  echo "Backend did not recover to the desired Ready replica count." >&2
  "${KUBECTL}" -n "${NS}" get deployment backend -o wide >&2 || true
  "${KUBECTL}" -n "${NS}" get pods -l app.kubernetes.io/name=backend -o wide >&2 || true
  "${KUBECTL}" -n "${NS}" describe deployment backend >&2 || true
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
