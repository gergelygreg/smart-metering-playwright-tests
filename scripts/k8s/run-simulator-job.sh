#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
KUBECTL="${ROOT}/.tools/k8s/kubectl"
NS="smart-metering"

SERIAL="${1:?serial number required}"
PROFILE="${2:-mixed}"
COUNT="${3:-4}"
INTERVAL_MS="${4:-150}"

safe_name="$(
  printf '%s' "${SERIAL}" |
  tr '[:upper:]' '[:lower:]' |
  tr -cs 'a-z0-9-' '-' |
  sed 's/^-*//;s/-*$//' |
  cut -c1-40
)"

JOB_NAME="sim-${safe_name}-$(date +%s)"
RUNTIME="${ROOT}/.k8s-runtime"
MANIFEST="${RUNTIME}/${JOB_NAME}.yaml"

mkdir -p "${RUNTIME}"

sed \
  -e "s/__JOB_NAME__/${JOB_NAME}/g" \
  -e "s/__SERIAL__/${SERIAL}/g" \
  -e "s/__PROFILE__/${PROFILE}/g" \
  -e "s/__COUNT__/${COUNT}/g" \
  -e "s/__INTERVAL_MS__/${INTERVAL_MS}/g" \
  "${ROOT}/k8s/jobs/device-simulator-job.yaml" \
  > "${MANIFEST}"

"${KUBECTL}" apply -f "${MANIFEST}"

if ! "${KUBECTL}" \
  -n "${NS}" \
  wait \
  --for=condition=complete \
  "job/${JOB_NAME}" \
  --timeout=180s
then
  "${KUBECTL}" -n "${NS}" describe "job/${JOB_NAME}" || true
  "${KUBECTL}" -n "${NS}" logs "job/${JOB_NAME}" --all-containers=true || true
  exit 1
fi

"${KUBECTL}" -n "${NS}" logs "job/${JOB_NAME}"

echo
echo "Simulator Kubernetes Job completed."
echo "Job:    ${JOB_NAME}"
echo "Serial: ${SERIAL}"
