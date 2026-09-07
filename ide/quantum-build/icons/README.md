## Regenerate icons

Runs automatically from `prepare_vscode.sh` / `./build.sh`, or manually:

```bash
./icons/prepare_icons.sh
```

## Source files (do not overwrite from scripts)

| File | Use for |
|------|---------|
| `assets/Quantum.png` | **Light UI** — black mark, transparent. Letterpress-light/hcLight, installer BMPs, docs |
| `assets/Quantum-dark.png` | **Dark UI** — white mark, transparent. Letterpress-dark/hcDark, `code-icon.svg`, Linux SVG |
| `assets/app-icon.png` | **App icon** — white mark on transparent square → `.ico`, `linux/code.png`, server PWA, macOS full-bleed black plate (~88% mark; system applies squircle) |
| `assets/app-icon-light.png` | Black mark on transparent square (light-context app mark) |
| `assets/lockup-light.png` / `lockup-dark.png` | Horizontal icon + Outfit Bold “QUANTUM” wordmark (transparent; black/white only) |
| `assets/banner-lockup-*.png` | Wide white/black marketing banners |
| `assets/lockup-banner-light.png` / `lockup-banner-dark.png` | Same lockup on solid white/black (WiX banner, docs) |
| `assets/marketing/readme-banner.png` | README hero — pure black plate + white lockup |
| `assets/screenshots/` | Product UI demos for README/docs (not used by icon scripts) |
| `assets/sessions-logo-*.svg` | Sessions UI logos (`-light` = light glyph for dark chrome) |

Full asset map (brand vs marketing vs screenshots): [`assets/README.md`](../../assets/README.md).

App icons downscale with Lanczos when the master is large enough; smaller masters are upscaled once to each target size (then lightly sharpened). In-app SVGs (empty-editor watermark, `code-icon.svg`) embed **512×512** rasters (2× the 256px UI size for Retina). Use a **square** `app-icon.png` (≥1024px ideal) and **≥1024px** marks for the sharpest in-app logos.

Resize only. macOS `.icns` output is a **full-bleed black** square with the white mark centered (~88% longest edge). The system applies the squircle mask — do not pre-mask (that double-insets the icon in Dock).
