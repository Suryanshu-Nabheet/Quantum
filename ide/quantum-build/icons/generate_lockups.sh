#!/usr/bin/env bash
# Regenerate horizontal lockups + single README banner.
# Wordmark: Outfit Bold (OFL) — geometric sans for Quantum.
# Palette: pure black (#000) and pure white (#FFF) only.
# Masters: assets/Quantum.png + assets/Quantum-dark.png
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ASSETS="${ROOT}/assets"
FONT_DIR="${ASSETS}/fonts"
FONT_REG="${FONT_DIR}/Outfit-Bold.ttf"
REPO_ROOT="$(cd "${ROOT}/.." && pwd)"
REPO_ASSETS="${REPO_ROOT}/assets"
PY=""

ensure_wordmark_font() {
  if [[ -f "${FONT_REG}" ]]; then
    return 0
  fi
  echo "== Fetching Outfit Bold (Google Fonts / OFL) =="
  mkdir -p "${FONT_DIR}"
  local css="/tmp/quantum-brand-font.css"
  curl -fsSL -A 'Mozilla/5.0' \
    'https://fonts.googleapis.com/css2?family=Outfit:wght@700&display=swap' \
    -o "${css}"
  local url
  url="$(rg -o 'https://fonts.gstatic.com/[^)]+\.ttf' "${css}" | head -1 || true)"
  [[ -n "${url}" ]] || { echo "Could not resolve Outfit TTF URL" >&2; exit 1; }
  curl -fsSL -o "${FONT_REG}" "${url}"
  echo "Wrote ${FONT_REG}"
}

ensure_wordmark_font

[[ -f "${ASSETS}/Quantum.png" ]] || { echo "Missing ${ASSETS}/Quantum.png" >&2; exit 1; }
[[ -f "${ASSETS}/Quantum-dark.png" ]] || { echo "Missing ${ASSETS}/Quantum-dark.png" >&2; exit 1; }
[[ -f "${FONT_REG}" ]] || { echo "Missing ${FONT_REG}" >&2; exit 1; }

if [[ -x /tmp/quantum-brand/venv/bin/python ]]; then
  PY=/tmp/quantum-brand/venv/bin/python
elif python3 -c 'import PIL' 2>/dev/null; then
  PY=python3
else
  echo "Pillow required (venv or system)." >&2
  exit 1
fi

"${PY}" - "${ASSETS}" "${FONT_REG}" <<'PY'
"""
Quantum lockup — black / white only.

Proportions:
  mark_h / text_h ≈ 1.91
  gap / mark_h ≈ 0.22
  ink pure white or pure black; plates #000 / #FFF
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

assets = Path(sys.argv[1])
font_path = Path(sys.argv[2])

WORDMARK = "QUANTUM"
TAGLINE = "The AI Native Code Editor"
FONT_PX = 200
TRACKING_EM = -0.02
MARK_TO_TEXT = 1.91
GAP_TO_MARK = 0.22
PAD_TO_MARK = 0.10
# Pure black / white only (no warm / cream / brown tints).
INK_DARK = (255, 255, 255, 255)   # #FFFFFF
INK_LIGHT = (0, 0, 0, 255)        # #000000
TAG_DARK = (170, 170, 170, 255)   # neutral gray for tagline hierarchy


def tint_mark(mark: Image.Image, rgba: tuple[int, int, int, int]) -> Image.Image:
    """Recolor opaque mark pixels to shared lockup ink while keeping alpha."""
    r, g, b, _ = rgba
    out = mark.copy()
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            pr, pg, pb, pa = px[x, y]
            if pa == 0:
                continue
            lum = max(pr, pg, pb) / 255.0
            px[x, y] = (
                int(round(r * lum)),
                int(round(g * lum)),
                int(round(b * lum)),
                pa,
            )
    return out


def draw_tracked_text(
    draw: ImageDraw.ImageDraw,
    origin: tuple[float, float],
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int, int],
    tracking_em: float,
) -> float:
    x, y = origin
    em = font.size
    gap = em * tracking_em
    first_bbox = draw.textbbox((0, 0), text[0], font=font)
    y_adj = y - first_bbox[1]
    cursor = x
    for i, ch in enumerate(text):
        draw.text((cursor, y_adj), ch, font=font, fill=fill)
        cursor += draw.textlength(ch, font=font)
        if i < len(text) - 1:
            cursor += gap
    return cursor - x


def measure_tracked(
    text: str, font: ImageFont.FreeTypeFont, tracking_em: float
) -> tuple[int, int]:
    tmp = Image.new("RGBA", (1, 1))
    d = ImageDraw.Draw(tmp)
    em = font.size
    gap = em * tracking_em
    w = 0.0
    top = 0
    bottom = 0
    for i, ch in enumerate(text):
        bbox = d.textbbox((0, 0), ch, font=font)
        top = min(top, bbox[1]) if i else bbox[1]
        bottom = max(bottom, bbox[3]) if i else bbox[3]
        w += d.textlength(ch, font=font)
        if i < len(text) - 1:
            w += gap
    return int(round(w)), int(bottom - top)


def make_lockup(
    mark_path: Path,
    text_rgba: tuple[int, int, int, int],
    out: Path,
) -> None:
    mark = Image.open(mark_path).convert("RGBA")
    alpha = mark.split()[-1]
    bbox = alpha.getbbox()
    if bbox:
        mark = mark.crop(bbox)
    mark = tint_mark(mark, text_rgba)

    font = ImageFont.truetype(str(font_path), size=FONT_PX)
    tw, th = measure_tracked(WORDMARK, font, TRACKING_EM)

    icon_h = max(1, int(round(th * MARK_TO_TEXT)))
    scale = icon_h / mark.height
    icon_w = max(1, int(round(mark.width * scale)))
    icon = mark.resize((icon_w, icon_h), Image.Resampling.LANCZOS)

    gap = int(round(icon_h * GAP_TO_MARK))
    pad = int(round(icon_h * PAD_TO_MARK))

    content_h = max(icon_h, th)
    total_w = pad + icon_w + gap + tw + pad
    total_h = pad + content_h + pad
    canvas = Image.new("RGBA", (total_w, total_h), (0, 0, 0, 0))

    icon_y = pad + (content_h - icon_h) // 2
    canvas.paste(icon, (pad, icon_y), icon)

    draw = ImageDraw.Draw(canvas)
    text_y = pad + (content_h - th) // 2
    draw_tracked_text(
        draw,
        (pad + icon_w + gap, text_y),
        WORDMARK,
        font,
        text_rgba,
        TRACKING_EM,
    )
    canvas.save(out, "PNG")
    print(
        f"Wrote {out.name} {canvas.size[0]}x{canvas.size[1]} "
        f"mark={icon_w}x{icon_h} text_h={th} gap={gap} "
        f"Outfit tracking={TRACKING_EM} mark/text={icon_h/th:.3f}"
    )


def make_readme_banner(out: Path) -> None:
    """Full-width README banner — pure black plate, white lockup + tagline."""
    mark = Image.open(assets / "Quantum-dark.png").convert("RGBA")
    alpha = mark.split()[-1]
    bbox = alpha.getbbox()
    if bbox:
        mark = mark.crop(bbox)
    mark = tint_mark(mark, INK_DARK)

    name_font = ImageFont.truetype(str(font_path), size=104)
    tag_font = ImageFont.truetype(str(font_path), size=34)

    tw, th = measure_tracked(WORDMARK, name_font, TRACKING_EM)
    _tag_w, tag_h = measure_tracked(TAGLINE, tag_font, 0.02)

    icon_h = max(1, int(round(th * MARK_TO_TEXT)))
    scale = icon_h / mark.height
    icon_w = max(1, int(round(mark.width * scale)))
    icon = mark.resize((icon_w, icon_h), Image.Resampling.LANCZOS)

    gap = int(round(icon_h * GAP_TO_MARK))
    row_gap = 28
    content_w = icon_w + gap + tw
    total_w = 2400
    total_h = 400
    canvas = Image.new("RGBA", (total_w, total_h), (0, 0, 0, 255))

    block_h = icon_h + row_gap + tag_h
    origin_x = (total_w - content_w) // 2
    origin_y = (total_h - block_h) // 2

    canvas.paste(icon, (origin_x, origin_y), icon)
    draw = ImageDraw.Draw(canvas)
    name_x = origin_x + icon_w + gap
    draw_tracked_text(
        draw,
        (name_x, origin_y + (icon_h - th) // 2),
        WORDMARK,
        name_font,
        INK_DARK,
        TRACKING_EM,
    )
    draw_tracked_text(
        draw,
        (name_x, origin_y + icon_h + row_gap),
        TAGLINE,
        tag_font,
        TAG_DARK,
        0.02,
    )

    canvas.save(out, "PNG")
    print(f"Wrote {out.name} {canvas.size[0]}x{canvas.size[1]} mark={icon_w}x{icon_h} text_h={th}")


make_lockup(assets / "Quantum.png", INK_LIGHT, assets / "lockup-light.png")
make_lockup(assets / "Quantum-dark.png", INK_DARK, assets / "lockup-dark.png")
make_readme_banner(assets / "readme-banner.png")
PY

cp -f "${ASSETS}/lockup-light.png" "${ASSETS}/lockup-horizontal-light.png"
cp -f "${ASSETS}/lockup-dark.png" "${ASSETS}/lockup-horizontal-dark.png"
cp -f "${ASSETS}/lockup-light.png" "${ASSETS}/Quantum_Name.png"

magick "${ASSETS}/lockup-light.png" -background '#FFFFFF' -flatten PNG24:"${ASSETS}/lockup-banner-light.png"
magick "${ASSETS}/lockup-dark.png" -background '#000000' -flatten PNG24:"${ASSETS}/lockup-banner-dark.png"
magick "${ASSETS}/lockup-banner-light.png" -gravity center -background '#FFFFFF' -extent 2400x640 PNG24:"${ASSETS}/banner-lockup-light.png"
magick "${ASSETS}/lockup-banner-dark.png" -gravity center -background '#000000' -extent 2400x640 PNG24:"${ASSETS}/banner-lockup-dark.png"

mkdir -p "${REPO_ASSETS}"
cp -f "${ASSETS}/readme-banner.png" "${REPO_ASSETS}/readme-banner.png"
rm -f "${ASSETS}/readme-banner-light.png" "${ASSETS}/readme-banner-dark.png" \
      "${REPO_ASSETS}/readme-banner-light.png" "${REPO_ASSETS}/readme-banner-dark.png" 2>/dev/null || true

for f in lockup-light.png lockup-dark.png lockup-horizontal-light.png lockup-horizontal-dark.png \
         lockup-banner-light.png lockup-banner-dark.png banner-lockup-light.png banner-lockup-dark.png \
         Quantum_Name.png; do
  [[ -f "${ASSETS}/${f}" ]] && cp -f "${ASSETS}/${f}" "${REPO_ASSETS}/${f}"
done

echo "Lockups + README banner ready (Outfit Bold / black-white)."
