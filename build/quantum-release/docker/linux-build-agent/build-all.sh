#!/usr/bin/env bash
set -euo pipefail

REGISTRY="${REGISTRY:-ghcr.io/suryanshu-nabheet}"
IMAGE="${IMAGE:-quantum-linux-build-agent}"
ROOT="$(cd "$(dirname "$0")" && pwd)"

for dir in "${ROOT}"/*/; do
  tag="$(basename "${dir}")"
  echo "Building ${REGISTRY}/${IMAGE}:${tag} ..."
  docker build -t "${REGISTRY}/${IMAGE}:${tag}" "${dir}"
  if [[ "${PUSH:-}" == "yes" ]]; then
    docker push "${REGISTRY}/${IMAGE}:${tag}"
  fi
done

echo "Done."
