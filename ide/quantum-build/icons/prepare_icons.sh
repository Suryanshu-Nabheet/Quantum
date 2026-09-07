#!/usr/bin/env bash
# Regenerate all branding assets before prepare_vscode / build.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "== Quantum icon pipeline =="
bash "${ROOT}/icons/generate_lockups.sh"
bash "${ROOT}/icons/generate_quantum_assets.sh"
bash "${ROOT}/icons/verify_icons.sh"

# README badge — prefer horizontal lockup
if [[ -f "${ROOT}/docs/img/quantum-lockup.png" ]]; then
  cp -f "${ROOT}/docs/img/quantum-lockup.png" "${ROOT}/Quantum.png"
elif [[ -f "${ROOT}/assets/lockup-banner-light.png" ]]; then
  cp -f "${ROOT}/assets/lockup-banner-light.png" "${ROOT}/Quantum.png"
else
  cp -f "${ROOT}/docs/img/quantum.png" "${ROOT}/Quantum.png" 2>/dev/null || cp -f "${ROOT}/assets/Quantum.png" "${ROOT}/Quantum.png"
fi

# Sync into the parent Quantum repo assets/ (README + marketing)
REPO_ROOT="$(cd "${ROOT}/.." && pwd)"
if [[ -d "${REPO_ROOT}/assets" ]]; then
  echo "== Sync parent repo assets/ =="
  cp -f "${ROOT}/assets/Quantum.png" "${REPO_ROOT}/assets/Quantum.png"
  cp -f "${ROOT}/assets/Quantum-dark.png" "${REPO_ROOT}/assets/Quantum-dark.png" 2>/dev/null || true
  cp -f "${ROOT}/assets/app-icon.png" "${REPO_ROOT}/assets/app-icon.png"
  cp -f "${ROOT}/assets/app-icon-light.png" "${REPO_ROOT}/assets/app-icon-light.png" 2>/dev/null || true
  cp -f "${ROOT}/assets/lockup-banner-light.png" "${REPO_ROOT}/assets/lockup-horizontal-light.png"
  cp -f "${ROOT}/assets/lockup-banner-dark.png" "${REPO_ROOT}/assets/lockup-horizontal-dark.png"
  cp -f "${ROOT}/assets/lockup-light.png" "${REPO_ROOT}/assets/lockup-light.png"
  cp -f "${ROOT}/assets/lockup-dark.png" "${REPO_ROOT}/assets/lockup-dark.png"
  cp -f "${ROOT}/assets/banner-lockup-light.png" "${REPO_ROOT}/assets/banner-lockup-light.png"
  cp -f "${ROOT}/assets/banner-lockup-dark.png" "${REPO_ROOT}/assets/banner-lockup-dark.png"
  # Wordmark-style name plate (lockup on dark) replaces old Quantum_Name.png
  cp -f "${ROOT}/assets/banner-lockup-dark.png" "${REPO_ROOT}/assets/Quantum_Name.png"
  # Drop obsolete duplicate
  rm -f "${REPO_ROOT}/assets/QUANTUM copy.png"
fi

echo "Icons ready."
