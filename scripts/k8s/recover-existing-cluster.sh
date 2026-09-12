#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
KIND="${ROOT}/.tools/k8s/kind"
KUBECTL="${ROOT}/.tools/k8s/kubectl"
CLUSTER_NAME="${KIND_CLUSTER_NAME:-smart-metering}"
NODE_NAME="${CLUSTER_NAME}-control-plane"

if [[ ! -x "${KIND}" ]]; then
  echo "kind binary not found: ${KIND}" >&2
  exit 1
fi

if [[ ! -x "${KUBECTL}" ]]; then
  echo "kubectl binary not found: ${KUBECTL}" >&2
  exit 1
fi

echo "Waiting for Docker daemon..."

docker_ready=0

for attempt in $(seq 1 60); do
  if docker info >/dev/null 2>&1; then
    docker_ready=1
    break
  fi

  sleep 1
done

if [[ "${docker_ready}" != "1" ]]; then
  echo "Docker daemon is not available inside WSL." >&2
  exit 1
fi

echo "Docker daemon: READY"

if ! "${KIND}" get clusters | grep -Fxq "${CLUSTER_NAME}"; then
  echo "kind cluster does not exist: ${CLUSTER_NAME}" >&2
  echo
  echo "Known kind clusters:" >&2
  "${KIND}" get clusters >&2 || true
  echo
  echo "Docker containers:" >&2
  docker ps -a >&2 || true
  exit 1
fi

if ! docker inspect "${NODE_NAME}" >/dev/null 2>&1; then
  echo "kind control-plane container not found: ${NODE_NAME}" >&2
  docker ps -a >&2 || true
  exit 1
fi

state="$(docker inspect --format '{{.State.Status}}' "${NODE_NAME}")"

echo "kind node state before recovery: ${state}"

if [[ "${state}" != "running" ]]; then
  echo "Starting retained kind control-plane container..."
  docker start "${NODE_NAME}"
fi

echo "Refreshing kubeconfig..."
"${KIND}" export kubeconfig --name "${CLUSTER_NAME}" >/dev/null

echo "Waiting for Kubernetes API..."

for attempt in $(seq 1 90); do
  if "${KUBECTL}" get nodes >/dev/null 2>&1; then
    echo
    echo "Recovered Kubernetes node:"
    "${KUBECTL}" get nodes -o wide
    echo
    echo "Existing smart-metering workloads:"
    "${KUBECTL}" -n smart-metering get pods,pvc 2>/dev/null || true
    exit 0
  fi

  sleep 2
done

echo "Kubernetes API did not recover." >&2
echo
echo "Control-plane container:" >&2
docker ps -a --filter "name=${NODE_NAME}" >&2 || true
echo
echo "Control-plane logs:" >&2
docker logs --tail 300 "${NODE_NAME}" >&2 || true

exit 1