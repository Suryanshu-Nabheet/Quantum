#!/usr/bin/env bash
# Branding masters (committed under assets/):
#   Quantum.png          — black mark, transparent (light UI / letterpress-light)
#   Quantum-dark.png     — white mark, transparent (dark UI / letterpress-dark / app mark)
#   app-icon.png         — white mark on transparent square (dock / .ico / .icns plate)
#   app-icon-light.png   — black mark on transparent square (light-context app mark)
#   lockup-*.png         — horizontal icon + "Quantum" wordmark (banners / docs)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOGO_LIGHT="${ROOT}/assets/Quantum.png"
LOGO_DARK="${ROOT}/assets/Quantum-dark.png"
APP_SOURCE="${ROOT}/assets/app-icon.png"
APP_SOURCE_LIGHT="${ROOT}/assets/app-icon-light.png"
LOCKUP_LIGHT="${ROOT}/assets/lockup-light.png"
LOCKUP_BANNER_LIGHT="${ROOT}/assets/lockup-banner-light.png"
DARWIN_TEMPLATE="${ROOT}/icons/template_macos.png"
BUILD="${ROOT}/icons/.build"
STABLE_RES="${ROOT}/src/stable/resources"
STABLE_MEDIA="${ROOT}/src/stable/src/vs/workbench/browser"
INSIDER_RES="${ROOT}/src/insider/resources"
INSIDER_MEDIA="${ROOT}/src/insider/src/vs/workbench/browser"

# Inset for Linux/Windows/server app icons.
# The mark is trimmed to its own opaque bounding box first (see scale_app_icon), so this margin is measured
# against actual content, not the source file's internal padding.
# ~8% per side → ~84% fill so the mark isn't edge-to-edge on taskbar / .ico.
APP_ICON_MARGIN_PCT=8
# macOS dock: FULL-BLEED black canvas + centered white mark.
# Do NOT pre-mask with template_macos.png — macOS applies the squircle itself. Pre-masking
# left ~16% transparent margin and made the mark look tiny in Dock (double inset).
# ~64% of the canvas — between the old edge-to-edge 88% and the too-small 50%.
# Leaves padding after macOS applies the squircle mask, without looking tiny.
DARWIN_LOGO_SIZE_PCT=64
# Pure black plate only (no warm / brown tints).
DARWIN_PLATE_COLOR='#000000'
INSTALLER_MARGIN_PCT=10
# Empty-editor watermark renders up to 256 CSS px (512 @2x) — embed at least this size.
LETTERPRESS_SIZE=512
# Modest inset so CSS max-width (170px) shows a full-size mark again.
LETTERPRESS_MARGIN_PCT=8
UI_LOGO_SIZE=512

if ! command -v magick &>/dev/null; then
  echo "ImageMagick (magick) is required." >&2
  exit 1
fi

img_dims() {
  magick identify -format '%w %h' "$1"
}

[[ -f "${LOGO_LIGHT}" ]] || { echo "Missing ${LOGO_LIGHT}" >&2; exit 1; }
[[ -f "${LOGO_DARK}" ]] || { echo "Missing ${LOGO_DARK}" >&2; exit 1; }
[[ -f "${APP_SOURCE}" ]] || { echo "Missing ${APP_SOURCE}" >&2; exit 1; }
[[ -f "${DARWIN_TEMPLATE}" ]] || { echo "Missing ${DARWIN_TEMPLATE}" >&2; exit 1; }

rm -rf "${BUILD}"
mkdir -p "${BUILD}" "${ROOT}/docs/img"

read -r LOGO_W LOGO_H <<< "$(img_dims "${LOGO_LIGHT}")"
read -r APP_W APP_H <<< "$(img_dims "${APP_SOURCE}")"
APP_MAX=$(( APP_W > APP_H ? APP_W : APP_H ))

LOGO_MAX=$(( LOGO_W > LOGO_H ? LOGO_W : LOGO_H ))
if [[ "${APP_W}" -ne "${APP_H}" ]]; then
  echo "WARNING: assets/app-icon.png is ${APP_W}x${APP_H} (not square). Dock icon will letterbox; use 1024x1024 for a full-size mark." >&2
fi
if [[ "${APP_MAX}" -lt 1024 ]]; then
  echo "NOTE: assets/app-icon.png is ${APP_W}x${APP_H}; app outputs >${APP_MAX}px use Lanczos upscale from this master." >&2
fi
if [[ "${LOGO_MAX}" -lt "${LETTERPRESS_SIZE}" ]]; then
  echo "NOTE: assets/Quantum.png is ${LOGO_W}x${LOGO_H}; in-app UI upscales to ${LETTERPRESS_SIZE}px for letterpress (use ≥1024px source for best quality)." >&2
fi

# Render the app mark centered inside a transparent square that it fills to ~(100 - 2*margin)%.
#
# The source is trimmed to its own opaque bounding box FIRST so that any internal padding in the
# master file does not shrink the final mark (this was the cause of the tiny, "broken"-looking dock
# icon). The trimmed mark is then scaled so its longest edge fills the inner box and centered on a
# transparent canvas.
#
# Prefer the transparent logo master when the dedicated app master has no alpha channel (older
# Quantum app-icon masters were opaque JPEGs saved as .png, which produced a black square in the
# dock).
scale_app_icon() {
  local out="$1" size="$2" margin_pct="${3:-${APP_ICON_MARGIN_PCT}}"
  local inner=$(( size * (100 - 2 * margin_pct) / 100 ))
  [[ "${inner}" -lt 1 ]] && inner=1
  local source="${APP_SOURCE}"
  if ! magick identify -format '%[channels]' "${APP_SOURCE}" | grep -q 'a'; then
    source="${LOGO_DARK}"
  fi
  magick "${source}" \
    -background none \
    -trim +repage \
    -filter Lanczos \
    -resize "${inner}x${inner}" \
    -unsharp 0x0.75+0.75+0.008 \
    -gravity center -background none -extent "${size}x${size}" \
    PNG32:"${out}"
}

scale_logo_icon() {
  local out="$1" size="$2" margin_pct="${3:-5}" source="${4:-${LOGO_LIGHT}}"
  local inner=$(( size * (100 - 2 * margin_pct) / 100 ))
  [[ "${inner}" -lt 1 ]] && inner=1
  magick "${source}" \
    -filter Lanczos \
    -resize "${inner}x${inner}>" \
    -background none -gravity center -extent "${size}x${size}" \
    PNG32:"${out}"
}

png_to_ico() {
  magick "$1" -define icon:auto-resize=256,128,96,64,48,32,24,16 "$2"
}

build_darwin_app_icon() {
  local out="$1" size="$2"
  local logo_size=$(( size * DARWIN_LOGO_SIZE_PCT / 100 ))
  [[ "${logo_size}" -lt 1 ]] && logo_size=1
  # Full-bleed opaque black square + centered white mark. macOS (Big Sur+) applies the
  # squircle mask — pre-masking with template_macos.png inset the whole icon in Dock.
  # template_macos.png is still required on disk for legacy tooling / verification.
  magick \
    -size "${size}x${size}" "xc:${DARWIN_PLATE_COLOR}" \
    \( "${APP_SOURCE}" \
      -background none \
      -trim +repage \
      -filter Lanczos \
      -resize "${logo_size}x${logo_size}" \
      -unsharp 0x0.75+0.75+0.008 \
    \) \
    -gravity center -compose Over -composite \
    PNG32:"${out}"
}

png_to_icns_from_source() {
  local icns="$1"
  icns="$(cd "$(dirname "${icns}")" && pwd)/$(basename "${icns}")"
  local iconset="${icns%.icns}.iconset"
  rm -rf "${iconset}"
  mkdir -p "${iconset}"
  for s in 16 32 128 256 512; do
    build_darwin_app_icon "${iconset}/icon_${s}x${s}.png" "${s}"
    build_darwin_app_icon "${iconset}/icon_${s}x${s}@2x.png" "$((s * 2))"
  done
  if command -v iconutil &>/dev/null; then
    iconutil -c icns "${iconset}" -o "${icns}" && rm -rf "${iconset}"
  elif python3 -c 'import icnsutil' 2>/dev/null; then
    python3 - "${iconset}" "${icns}" <<'PY'
import sys
from pathlib import Path
import icnsutil

iconset, icns_path = Path(sys.argv[1]), Path(sys.argv[2])
img = icnsutil.IcnsFile()
for p in sorted(iconset.glob("icon_*.png")):
    # Filename encodes size + retina; icnsutil guesses type from name.
    img.add_media(file=str(p), force=True)
img.write(str(icns_path))
print(f"Wrote {icns_path} via icnsutil ({len(list(iconset.glob('icon_*.png')))} sizes)")
PY
    rm -rf "${iconset}"
  else
    echo "iconutil/icnsutil not found; iconset at ${iconset}" >&2
    return 1
  fi
}

# Transparent logo on a square canvas for in-app SVGs (letterpress, code-icon).
build_logo_png_at_size() {
  local out="$1" size="$2" margin_pct="${3:-5}" source="${4:-${LOGO_LIGHT}}"
  local source_max
  read -r _sw _sh <<< "$(img_dims "${source}")"
  source_max=$(( _sw > _sh ? _sw : _sh ))
  local inner=$(( size * (100 - 2 * margin_pct) / 100 ))
  [[ "${inner}" -lt 1 ]] && inner=1
  local resize_dims="${inner}x${inner}"
  if [[ "${source_max}" -ge "${inner}" ]]; then
    resize_dims="${resize_dims}>"
  fi
  magick "${source}" \
    -filter Lanczos \
    -resize "${resize_dims}" \
    -unsharp 0x0.75+0.75+0.008 \
    -background none -gravity center -extent "${size}x${size}" \
    PNG32:"${out}"
}

embed_svg() {
  local png="$1" out_svg="$2" opacity="${3:-1}"
  python3 - "${png}" "${out_svg}" "${opacity}" <<'PY'
import base64, struct, sys

png, out, opacity = sys.argv[1:4]
raw = open(png, "rb").read()
if raw[:8] != b"\x89PNG\r\n\x1a\n":
    raise SystemExit(f"not a PNG: {png}")
w = struct.unpack(">I", raw[16:20])[0]
h = struct.unpack(">I", raw[20:24])[0]
data = base64.b64encode(raw).decode("ascii")
svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="{w}" height="{h}" viewBox="0 0 {w} {h}">
  <image width="{w}" height="{h}" opacity="{opacity}"
    preserveAspectRatio="xMidYMid meet"
    xlink:href="data:image/png;base64,{data}"/>
</svg>
'''
open(out, "w", encoding="utf-8").write(svg)
PY
}

build_installer_bmp() {
  local out="$1" canvas="$2" max_logo="$3" gravity="${4:-center}"
  local cw ch inner_w inner_h
  IFS='x' read -r cw ch <<< "${canvas}"
  inner_w=$(( cw * (100 - 2 * INSTALLER_MARGIN_PCT) / 100 ))
  inner_h=$(( ch * (100 - 2 * INSTALLER_MARGIN_PCT) / 100 ))
  if [[ "${max_logo}" -lt "${inner_w}" && "${max_logo}" -lt "${inner_h}" ]]; then
    inner_w="${max_logo}"
    inner_h="${max_logo}"
  fi
  magick -size "${canvas}" xc:white \
    \( "${LOGO_LIGHT}" -filter Lanczos -resize "${inner_w}x${inner_h}>" \) \
    -gravity "${gravity}" -compose Over -composite \
    -type TrueColor -define bmp:format=bmp3 \
    "${out}"
}

# WiX banner uses the horizontal lockup (icon + wordmark) on white.
build_wix_banner_bmp() {
  local out="$1" canvas="$2"
  local lockup_src="${LOCKUP_BANNER_LIGHT}"
  if [[ ! -f "${lockup_src}" ]]; then
    lockup_src="${LOCKUP_LIGHT}"
  fi
  if [[ ! -f "${lockup_src}" ]]; then
    # Fallback: mark only (legacy)
    build_installer_bmp "${out}" "${canvas}" 50 East
    return
  fi
  local cw ch
  IFS='x' read -r cw ch <<< "${canvas}"
  local max_h=$(( ch * 70 / 100 ))
  magick -size "${canvas}" xc:white \
    \( "${lockup_src}" -filter Lanczos -resize "x${max_h}" \) \
    -gravity East -geometry "+10+0" -compose Over -composite \
    -type TrueColor -define bmp:format=bmp3 \
    "${out}"
}

build_wix_dialog_bmp() {
  local out="$1" canvas="$2" logo_max="$3"
  magick -size "${canvas}" xc:white \
    \( "${LOGO_LIGHT}" -filter Lanczos -resize "${logo_max}x${logo_max}>" \) \
    -gravity West -geometry "+22+80" -compose Over -composite \
    -type TrueColor -define bmp:format=bmp3 \
    "${out}"
}

echo "== Sources: Quantum.png (light) ${LOGO_W}x${LOGO_H}, Quantum-dark.png, app-icon.png ${APP_W}x${APP_H} =="

echo "== App icons (app-icon.png white mark — dock / taskbar / .ico / .icns) =="
scale_app_icon "${BUILD}/app_1024.png" 1024
scale_app_icon "${BUILD}/app_512.png" 512
scale_app_icon "${BUILD}/ico_base.png" 256

png_to_ico "${BUILD}/ico_base.png" "${BUILD}/favicon.ico"

# UI marks: black for light chrome, white for dark chrome
build_logo_png_at_size "${BUILD}/ui_logo_light.png" "${UI_LOGO_SIZE}" 5 "${LOGO_LIGHT}"
build_logo_png_at_size "${BUILD}/ui_logo_dark.png" "${UI_LOGO_SIZE}" 5 "${LOGO_DARK}"
magick "${BUILD}/ui_logo_light.png" -filter Lanczos -resize 80x80 "${BUILD}/ui_logo_w80.png"

echo "== In-editor UI (theme-aware letterpress + code-icon) =="
for q in stable insider; do
  d="${ROOT}/icons/${q}"
  mkdir -p "${d}"
  # Stable SVGs used by legacy build_icons path — black mark (reads on light plates)
  embed_svg "${BUILD}/ui_logo_light.png" "${d}/quantum_cnl.svg"
  embed_svg "${BUILD}/ui_logo_light.png" "${d}/quantum_clt.svg"
  embed_svg "${BUILD}/ui_logo_w80.png" "${d}/quantum_cnl_w80_b8.svg"
done

for theme in dark light hcDark hcLight; do
  case "${theme}" in
    dark)
      op="0.55"
      src="${LOGO_DARK}"
      ;;
    light)
      op="0.14"
      src="${LOGO_LIGHT}"
      ;;
    hcDark)
      op="0.70"
      src="${LOGO_DARK}"
      ;;
    hcLight)
      op="0.22"
      src="${LOGO_LIGHT}"
      ;;
  esac
  tmp="${BUILD}/lp_${theme}.png"
  build_logo_png_at_size "${tmp}" "${LETTERPRESS_SIZE}" "${LETTERPRESS_MARGIN_PCT}" "${src}"
  for base in "${STABLE_MEDIA}" "${INSIDER_MEDIA}"; do
    embed_svg "${tmp}" "${base}/parts/editor/media/letterpress-${theme}.svg" "${op}"
  done
done

# code-icon: white mark (default dark workbench). Light themes invert via CSS where needed.
for base in "${STABLE_MEDIA}" "${INSIDER_MEDIA}"; do
  embed_svg "${BUILD}/ui_logo_dark.png" "${base}/media/code-icon.svg"
  embed_svg "${BUILD}/ui_logo_light.png" "${base}/media/code-icon-light.svg"
done

echo "== Linux / server / Windows app resources =="
scale_app_icon "${STABLE_RES}/linux/code.png" 1024
scale_app_icon "${INSIDER_RES}/linux/code.png" 1024
scale_logo_icon "${ROOT}/docs/img/quantum.png" 1024 5 "${LOGO_LIGHT}"
magick "${ROOT}/docs/img/quantum.png" -background white -alpha remove -quality 92 "${ROOT}/docs/img/quantum.jpg"
cp -f "${LOGO_LIGHT}" "${ROOT}/docs/img/quantum-source.png"
cp -f "${LOGO_DARK}" "${ROOT}/docs/img/quantum-source-dark.png"
if [[ -f "${LOCKUP_BANNER_LIGHT}" ]]; then
  cp -f "${LOCKUP_BANNER_LIGHT}" "${ROOT}/docs/img/quantum-lockup.png"
elif [[ -f "${LOCKUP_LIGHT}" ]]; then
  magick "${LOCKUP_LIGHT}" -background white -flatten PNG24:"${ROOT}/docs/img/quantum-lockup.png"
fi
if [[ -f "${ROOT}/assets/lockup-banner-dark.png" ]]; then
  cp -f "${ROOT}/assets/lockup-banner-dark.png" "${ROOT}/docs/img/quantum-lockup-dark.png"
fi

embed_svg "${BUILD}/ui_logo_dark.png" "${STABLE_RES}/linux/code.svg"
embed_svg "${BUILD}/ui_logo_dark.png" "${INSIDER_RES}/linux/code.svg"

mkdir -p "${STABLE_RES}/linux/rpm"
magick "${STABLE_RES}/linux/code.png" "${STABLE_RES}/linux/rpm/code.xpm"

png_to_ico "${BUILD}/ico_base.png" "${STABLE_RES}/win32/code.ico"
png_to_ico "${BUILD}/ico_base.png" "${INSIDER_RES}/win32/code.ico"
png_to_ico "${BUILD}/favicon.ico" "${STABLE_RES}/server/favicon.ico"
png_to_ico "${BUILD}/favicon.ico" "${INSIDER_RES}/server/favicon.ico"

scale_logo_icon "${STABLE_RES}/win32/code_70x70.png" 70 8 "${LOGO_DARK}"
scale_logo_icon "${STABLE_RES}/win32/code_150x150.png" 150 8 "${LOGO_DARK}"
scale_logo_icon "${INSIDER_RES}/win32/code_70x70.png" 70 8 "${LOGO_DARK}"
scale_logo_icon "${INSIDER_RES}/win32/code_150x150.png" 150 8 "${LOGO_DARK}"

scale_app_icon "${STABLE_RES}/server/code-192.png" 192
scale_app_icon "${STABLE_RES}/server/code-512.png" 512
scale_app_icon "${INSIDER_RES}/server/code-192.png" 192
scale_app_icon "${INSIDER_RES}/server/code-512.png" 512

echo "== macOS .icns (each size from app-icon.png white mark on black plate) =="
png_to_icns_from_source "${STABLE_RES}/darwin/code.icns" || true
cp -f "${STABLE_RES}/darwin/code.icns" "${INSIDER_RES}/darwin/code.icns" 2>/dev/null || \
  png_to_icns_from_source "${INSIDER_RES}/darwin/code.icns" || true

mkdir -p "${INSIDER_RES}/linux/rpm"
magick "${INSIDER_RES}/linux/code.png" "${INSIDER_RES}/linux/rpm/code.xpm" 2>/dev/null || true

echo "== Windows installer BMPs (light mark + lockup banners) =="
INNO_BIG=(
  "inno-big-100.bmp:164x314:126:center"
  "inno-big-125.bmp:192x386:147:center"
  "inno-big-150.bmp:246x459:190:center"
  "inno-big-175.bmp:273x556:211:center"
  "inno-big-200.bmp:328x604:255:center"
  "inno-big-225.bmp:355x700:273:center"
  "inno-big-250.bmp:410x797:317:center"
)
INNO_SMALL=(
  "inno-small-100.bmp:55x55:44:center"
  "inno-small-125.bmp:64x68:52:center"
  "inno-small-150.bmp:83x80:63:center"
  "inno-small-175.bmp:92x97:76:center"
  "inno-small-200.bmp:110x106:86:center"
  "inno-small-225.bmp:119x123:103:center"
  "inno-small-250.bmp:138x140:116:center"
)

for quality in stable insider; do
  win_dir="${ROOT}/src/${quality}/resources/win32"
  msi_dir="${ROOT}/build/windows/msi/resources/${quality}"
  mkdir -p "${win_dir}" "${msi_dir}"
  for spec in "${INNO_BIG[@]}" "${INNO_SMALL[@]}"; do
    IFS=':' read -r name canvas logo_px grav <<< "${spec}"
    build_installer_bmp "${win_dir}/${name}" "${canvas}" "${logo_px}" "${grav}"
  done
  build_wix_banner_bmp "${msi_dir}/wix-banner.bmp" "493x58"
  build_wix_dialog_bmp "${msi_dir}/wix-dialog.bmp" "493x312" 120
done

cp -f "${BUILD}/app_512.png" "${ROOT}/icons/corner_512.png"

# Sessions / product SVGs (light-colored glyph for dark UI, dark-colored for light UI)
echo "== Sessions + product SVG logos =="
for dest_root in \
  "${ROOT}/src/stable/src/vs/sessions/browser/media" \
  "${ROOT}/src/insider/src/vs/sessions/browser/media"
do
  mkdir -p "${dest_root}"
  [[ -f "${ROOT}/assets/sessions-logo-light.svg" ]] && cp -f "${ROOT}/assets/sessions-logo-light.svg" "${dest_root}/sessions-logo-light.svg"
  [[ -f "${ROOT}/assets/sessions-logo-dark.svg" ]] && cp -f "${ROOT}/assets/sessions-logo-dark.svg" "${dest_root}/sessions-logo-dark.svg"
  [[ -f "${ROOT}/assets/vscode-icon.svg" ]] && cp -f "${ROOT}/assets/vscode-icon.svg" "${dest_root}/vscode-icon.svg"
  [[ -f "${ROOT}/assets/sessions-icon.svg" ]] && cp -f "${ROOT}/assets/sessions-icon.svg" "${dest_root}/sessions-icon.svg"
done

# Sessions letterpress (chat empty state)
for quality in stable insider; do
  chat_media="${ROOT}/src/${quality}/src/vs/sessions/contrib/chat/browser/media"
  if [[ -d "${chat_media}" ]] || mkdir -p "${chat_media}"; then
    embed_svg "${BUILD}/ui_logo_dark.png" "${chat_media}/letterpress-sessions-dark.svg" "0.55"
    embed_svg "${BUILD}/ui_logo_light.png" "${chat_media}/letterpress-sessions-light.svg" "0.14"
  fi
done

# Welcome-empty-editor watermark uses horizontal lockups (not the old metallic assets).
echo "== Editor welcome lockups (horizontal lockup PNGs) =="
for base in "${STABLE_MEDIA}" "${INSIDER_MEDIA}"; do
  mkdir -p "${base}/parts/editor/media"
  if [[ -f "${LOCKUP_LIGHT}" ]]; then
    cp -f "${LOCKUP_LIGHT}" "${base}/parts/editor/media/lockup-horizontal-light.png"
  fi
  if [[ -f "${ROOT}/assets/lockup-dark.png" ]]; then
    cp -f "${ROOT}/assets/lockup-dark.png" "${base}/parts/editor/media/lockup-horizontal-dark.png"
  fi
done

REPO_ROOT="$(cd "${ROOT}/.." && pwd)"
if [[ -d "${REPO_ROOT}/resources" && -d "${REPO_ROOT}/src/vs/workbench/browser" ]]; then
  echo "== Sync local development resources =="
  cp -f "${STABLE_RES}/darwin/code.icns" "${REPO_ROOT}/resources/darwin/code.icns"
  # Dev Electron app embeds CFBundleIconFile=Quantum.icns — keep it in sync or Dock stays stale.
  ELECTRON_APP_ICNS="${REPO_ROOT}/.build/electron/Quantum.app/Contents/Resources/Quantum.icns"
  if [[ -f "${ELECTRON_APP_ICNS}" ]]; then
    cp -f "${STABLE_RES}/darwin/code.icns" "${ELECTRON_APP_ICNS}"
    touch "${REPO_ROOT}/.build/electron/Quantum.app"
    echo "Synced .build/electron/Quantum.app icon + touched bundle"
  fi
  cp -f "${STABLE_RES}/linux/code.png" "${REPO_ROOT}/resources/linux/code.png"
  cp -f "${STABLE_RES}/linux/code.svg" "${REPO_ROOT}/resources/linux/code.svg"
  cp -f "${STABLE_RES}/linux/rpm/code.xpm" "${REPO_ROOT}/resources/linux/rpm/code.xpm"
  cp -f "${STABLE_RES}/win32/code.ico" "${REPO_ROOT}/resources/win32/code.ico"
  cp -f "${STABLE_RES}/win32/code_70x70.png" "${REPO_ROOT}/resources/win32/code_70x70.png"
  cp -f "${STABLE_RES}/win32/code_150x150.png" "${REPO_ROOT}/resources/win32/code_150x150.png"
  cp -f "${STABLE_RES}/server/favicon.ico" "${REPO_ROOT}/resources/server/favicon.ico"
  cp -f "${STABLE_RES}/server/code-192.png" "${REPO_ROOT}/resources/server/code-192.png"
  cp -f "${STABLE_RES}/server/code-512.png" "${REPO_ROOT}/resources/server/code-512.png"
  cp -f "${STABLE_MEDIA}/media/code-icon.svg" "${REPO_ROOT}/src/vs/workbench/browser/media/code-icon.svg"
  cp -f "${STABLE_MEDIA}/media/code-icon-light.svg" "${REPO_ROOT}/src/vs/workbench/browser/media/code-icon-light.svg"
  for theme in dark light hcDark hcLight; do
    cp -f "${STABLE_MEDIA}/parts/editor/media/letterpress-${theme}.svg" "${REPO_ROOT}/src/vs/workbench/browser/parts/editor/media/letterpress-${theme}.svg"
  done
  # In-app welcome lockups (this is what empty-window watermark shows)
  cp -f "${STABLE_MEDIA}/parts/editor/media/lockup-horizontal-light.png" \
    "${REPO_ROOT}/src/vs/workbench/browser/parts/editor/media/lockup-horizontal-light.png"
  cp -f "${STABLE_MEDIA}/parts/editor/media/lockup-horizontal-dark.png" \
    "${REPO_ROOT}/src/vs/workbench/browser/parts/editor/media/lockup-horizontal-dark.png"
  # Sessions logos in the live tree
  if [[ -d "${REPO_ROOT}/src/vs/sessions/browser/media" ]]; then
    cp -f "${ROOT}/assets/sessions-logo-light.svg" "${REPO_ROOT}/src/vs/sessions/browser/media/sessions-logo-light.svg"
    cp -f "${ROOT}/assets/sessions-logo-dark.svg" "${REPO_ROOT}/src/vs/sessions/browser/media/sessions-logo-dark.svg"
    cp -f "${ROOT}/assets/vscode-icon.svg" "${REPO_ROOT}/src/vs/sessions/browser/media/vscode-icon.svg"
    cp -f "${ROOT}/assets/sessions-icon.svg" "${REPO_ROOT}/src/vs/sessions/browser/media/sessions-icon.svg"
  fi
  if [[ -d "${REPO_ROOT}/src/vs/sessions/contrib/chat/browser/media" ]]; then
    cp -f "${ROOT}/src/stable/src/vs/sessions/contrib/chat/browser/media/letterpress-sessions-dark.svg" \
      "${REPO_ROOT}/src/vs/sessions/contrib/chat/browser/media/letterpress-sessions-dark.svg"
    cp -f "${ROOT}/src/stable/src/vs/sessions/contrib/chat/browser/media/letterpress-sessions-light.svg" \
      "${REPO_ROOT}/src/vs/sessions/contrib/chat/browser/media/letterpress-sessions-light.svg"
  fi
fi

echo "Done. Light/dark marks → UI; app-icon.png → dock; lockups → welcome watermark + WiX."
