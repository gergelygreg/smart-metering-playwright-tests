#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TOOLS="${ROOT}/.tools/k8s"
KIND="${TOOLS}/kind"
KUBECTL="${TOOLS}/kubectl"

CLUSTER_NAME="${KIND_CLUSTER_NAME:-smart-metering}"
NODE_IMAGE="kindest/node:v1.37.0@sha256:a1ed56cfb0e7b93589bdf97c8cd566405a265939e3620fc4f5de89adff580ae5"

bash "${ROOT}/scripts/k8s/install-tools.sh"

if "${KIND}" get clusters 2>/dev/null | grep -Fxq "${CLUSTER_NAME}"; then
  if [[ "${RECREATE_CLUSTER:-1}" == "1" ]]; then
    echo "Deleting existing kind cluster: ${CLUSTER_NAME}"
    "${KIND}" delete cluster --name "${CLUSTER_NAME}"
  else
    echo "Reusing existing kind cluster: ${CLUSTER_NAME}"
    exit 0
  fi
fi

echo "Creating kind cluster ${CLUSTER_NAME}"
echo "Node image: ${NODE_IMAGE}"

"${KIND}" create cluster \
  --name "${CLUSTER_NAME}" \
  --image "${NODE_IMAGE}" \
  --config "${ROOT}/k8s/kind/cluster.yaml" \
  --wait 180s

"${KUBECTL}" config use-context "kind-${CLUSTER_NAME}" >/dev/null

"${KUBECTL}" wait \
  --for=condition=Ready \
  node \
  --all \
  --timeout=120s

echo
"${KUBECTL}" get nodes -o wide
echo
"${KUBECTL}" version
