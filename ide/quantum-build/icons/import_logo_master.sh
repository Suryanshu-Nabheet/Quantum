#!/usr/bin/env bash
# Rebuild branding masters from image/logo.png (black mark on white).
# Usage (from quantum-build): ./icons/import_logo_master.sh [path-to-logo.png]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "${ROOT}/.." && pwd)"
SRC="${1:-${REPO_ROOT}/image/logo.png}"
ASSETS="${ROOT}/assets"

[[ -f "${SRC}" ]] || { echo "Missing logo source: ${SRC}" >&2; exit 1; }
command -v magick &>/dev/null || { echo "ImageMagick (magick) required" >&2; exit 1; }

TMP="${ROOT}/icons/.build/import"
rm -rf "${TMP}"
mkdir -p "${TMP}" "${ASSETS}"

echo "== Importing ${SRC} =="

# Luminance → alpha: white becomes transparent, black stays opaque black
magick "${SRC}" -alpha off \( +clone -colorspace gray -negate \) \
  -compose CopyOpacity -composite \
  -trim +repage \
  -background none -gravity center -extent 1254x1254 \
  PNG32:"${TMP}/mark-light.png"

magick "${TMP}/mark-light.png" -channel RGB -negate +channel \
  PNG32:"${TMP}/mark-dark.png"

# App icons (1024): white mark for dark docks; black for light contexts.
# ~88% longest edge — validated Dock balance (matches DARWIN_LOGO_SIZE_PCT).
magick "${TMP}/mark-dark.png" -filter Lanczos -resize 901x901 \
  -background none -gravity center -extent 1024x1024 \
  -unsharp 0x0.75+0.75+0.008 \
  PNG32:"${ASSETS}/app-icon.png"

magick "${TMP}/mark-light.png" -filter Lanczos -resize 901x901 \
  -background none -gravity center -extent 1024x1024 \
  -unsharp 0x0.75+0.75+0.008 \
  PNG32:"${ASSETS}/app-icon-light.png"

cp -f "${TMP}/mark-light.png" "${ASSETS}/Quantum.png"
cp -f "${TMP}/mark-dark.png" "${ASSETS}/Quantum-dark.png"

# Horizontal lockups (canonical generator)
bash "${ROOT}/icons/generate_lockups.sh"

# Sessions SVGs
python3 - "${ASSETS}" <<'PY'
import base64, struct, subprocess, sys
from pathlib import Path
assets = Path(sys.argv[1])

def embed(png: Path, out: Path, size=128):
    raw = png.read_bytes()
    w = struct.unpack(">I", raw[16:20])[0]
    h = struct.unpack(">I", raw[20:24])[0]
    data = base64.b64encode(raw).decode("ascii")
    out.write_text(
        f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="{size}" height="{size}" viewBox="0 0 {w} {h}">
  <image width="{w}" height="{h}" preserveAspectRatio="xMidYMid meet"
    xlink:href="data:image/png;base64,{data}"/>
</svg>
''',
        encoding="utf-8",
    )

subprocess.check_call(["magick", str(assets / "Quantum-dark.png"), "-filter", "Lanczos", "-resize", "256x256", "PNG32:/tmp/q-sess-light.png"])
subprocess.check_call(["magick", str(assets / "Quantum.png"), "-filter", "Lanczos", "-resize", "256x256", "PNG32:/tmp/q-sess-dark.png"])
embed(Path("/tmp/q-sess-light.png"), assets / "sessions-logo-light.svg")
embed(Path("/tmp/q-sess-dark.png"), assets / "sessions-logo-dark.svg")
embed(Path("/tmp/q-sess-light.png"), assets / "vscode-icon.svg")
embed(Path("/tmp/q-sess-dark.png"), assets / "sessions-icon.svg")
print("Wrote sessions/product SVGs")
PY

echo "Masters updated in ${ASSETS}."
echo "Next: ./icons/prepare_icons.sh"
