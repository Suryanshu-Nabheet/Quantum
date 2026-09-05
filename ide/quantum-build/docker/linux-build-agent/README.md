# Quantum Linux build agents

Docker images used by GitHub Actions and `package_reh.sh` to compile Quantum for Linux (all architectures).

Image name: **`ghcr.io/Suryanshu-Nabheet/Quantum-quantum-linux-build-agent:<tag>`**

Tags match directory names, for example:

- `focal-x64`, `focal-arm64`, `focal-armhf`, `focal-riscv64`, `focal-ppc64le`
- `crimson-loong64`, `beige-devtoolset-loong64`
- `focal-devtoolset-x64`, `focal-devtoolset-arm64`, …

## Build and push (one-time per tag)

```bash
export REGISTRY=ghcr.io/suryanshu-nabheet
export IMAGE=quantum-linux-build-agent

for dir in docker/linux-build-agent/*/; do
  tag=$(basename "$dir")
  docker build -t "${REGISTRY}/${IMAGE}:${tag}" "$dir"
  docker push "${REGISTRY}/${IMAGE}:${tag}"
done
```

Grant the `quantum` GitHub repo `packages: write` so CI can pull these images.

## Source

Dockerfiles are vendored from the upstream [vscode-linux-build-agent](https://github.com/microsoft/vscode-linux-build-agent) project (MIT), adapted for Quantum CI.
