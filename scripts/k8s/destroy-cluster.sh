#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
KIND="${ROOT}/.tools/k8s/kind"
CLUSTER_NAME="${KIND_CLUSTER_NAME:-smart-metering}"

if [[ -x "${KIND}" ]] &&
   "${KIND}" get clusters 2>/dev/null | grep -Fxq "${CLUSTER_NAME}"
then
  "${KIND}" delete cluster --name "${CLUSTER_NAME}"
else
  echo "kind cluster ${CLUSTER_NAME} does not exist."
fi
