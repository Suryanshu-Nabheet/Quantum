#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fail=0

check_file() {
  local path="$1" min_w="${2:-0}" min_h="${3:-0}"
  if [[ ! -f "${path}" ]]; then
    echo "MISSING: ${path}" >&2
    fail=1
    return
  fi
  if [[ "${min_w}" -gt 0 ]] && command -v magick &>/dev/null; then
    read -r w h <<< "$(magick identify -format '%w %h' "${path}")"
    if [[ "${w}" -lt "${min_w}" || "${h}" -lt "${min_h}" ]]; then
      echo "TOO SMALL: ${path} (${w}x${h})" >&2
      fail=1
    fi
  fi
}

[[ -f "${ROOT}/assets/Quantum.png" ]] || { echo "Missing assets/Quantum.png" >&2; exit 1; }
[[ -f "${ROOT}/assets/Quantum-dark.png" ]] || { echo "Missing assets/Quantum-dark.png" >&2; exit 1; }
[[ -f "${ROOT}/assets/app-icon.png" ]] || { echo "Missing assets/app-icon.png" >&2; exit 1; }

echo "assets/Quantum.png        → light UI / letterpress-light / BMPs"
echo "assets/Quantum-dark.png   → dark UI / letterpress-dark / code-icon"
echo "assets/app-icon.png       → app icons (.ico, .icns, linux/code.png)"

for q in stable insider; do
  res="${ROOT}/src/${q}/resources"
  check_file "${res}/linux/code.png" 1024 1024
  check_file "${res}/win32/code.ico"
  check_file "${res}/darwin/code.icns"
  check_file "${res}/win32/inno-big-250.bmp"
done

[[ "${fail}" -eq 0 ]] || exit 1
echo "Icon verification passed."
