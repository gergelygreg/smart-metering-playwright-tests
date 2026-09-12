#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TOOLS="${ROOT}/.tools/k8s"
KIND="${TOOLS}/kind"

CLUSTER_NAME="${KIND_CLUSTER_NAME:-smart-metering}"
COMPOSE="${ROOT}/docker-compose.full.yml"

services=(
  backend
  frontend
  mqtt-ingestion
  kafka-event-service
  device-simulator
)

images=(
  smart-metering-api:k8s-local
  smart-metering-ui:k8s-local
  smart-metering-mqtt-ingestion:k8s-local
  smart-metering-kafka-event-service:k8s-local
  smart-meter-device-simulator:k8s-local
)

echo "Filesystem capacity:"
df -h "${ROOT}" /
echo

for service in "${services[@]}"; do
  echo "Building ${service} -> k8s-local"

  IMAGE_TAG=k8s-local \
    docker compose \
      -f "${COMPOSE}" \
      --profile simulator \
      build \
      --pull \
      "${service}"

  docker info >/dev/null
done

for image in "${images[@]}"; do
  echo "Loading ${image} into kind cluster ${CLUSTER_NAME}"

  "${KIND}" load docker-image \
    --name "${CLUSTER_NAME}" \
    "${image}"
done
