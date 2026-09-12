#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TOOLS="${ROOT}/.tools/k8s"

KIND_VERSION="v0.33.0"
KUBECTL_VERSION="v1.37.0"

mkdir -p "${TOOLS}"

case "$(uname -m)" in
  x86_64|amd64) ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *)
    echo "Unsupported architecture: $(uname -m)" >&2
    exit 1
    ;;
esac

if [[ ! -x "${TOOLS}/kind" ]] || ! "${TOOLS}/kind" version | grep -q "${KIND_VERSION#v}"; then
  echo "Installing kind ${KIND_VERSION} (${ARCH})"

  curl -fsSLo "${TOOLS}/kind-linux-${ARCH}" \
    "https://kind.sigs.k8s.io/dl/${KIND_VERSION}/kind-linux-${ARCH}"

  curl -fsSLo "${TOOLS}/kind-linux-${ARCH}.sha256sum" \
    "https://kind.sigs.k8s.io/dl/${KIND_VERSION}/kind-linux-${ARCH}.sha256sum"

  (
    cd "${TOOLS}"
    sha256sum --check "kind-linux-${ARCH}.sha256sum"
  )

  mv "${TOOLS}/kind-linux-${ARCH}" "${TOOLS}/kind"
  chmod +x "${TOOLS}/kind"
fi

if [[ ! -x "${TOOLS}/kubectl" ]] || ! "${TOOLS}/kubectl" version --client -o yaml 2>/dev/null | grep -q "gitVersion: ${KUBECTL_VERSION}"; then
  echo "Installing kubectl ${KUBECTL_VERSION} (${ARCH})"

  curl -fsSLo "${TOOLS}/kubectl" \
    "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/${ARCH}/kubectl"

  curl -fsSLo "${TOOLS}/kubectl.sha256" \
    "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/${ARCH}/kubectl.sha256"

  (
    cd "${TOOLS}"
    echo "$(cat kubectl.sha256)  kubectl" | sha256sum --check
  )

  chmod +x "${TOOLS}/kubectl"
fi

echo "kind:"
"${TOOLS}/kind" version

echo "kubectl:"
"${TOOLS}/kubectl" version --client
