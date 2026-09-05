# Quantum media assets

Where images live, and what they are for. **Do not dump new files at random** — pick the folder that matches the use case.

```
assets/
├── README.md                 ← this file
├── Quantum.png               ← brand masters (build + in-app UI)
├── Quantum-dark.png
├── app-icon.png / app-icon-light.png
├── lockup-*.png              ← wordmarks / installer lockups
├── banner-lockup-*.png
├── Quantum_Name.png
├── marketing/                ← README / site / store banners
│   └── readme-banner.png
└── screenshots/              ← product UI demos for docs & README
    ├── demo.png
    ├── agent-working-in-codebase.png
    ├── agent-browser-integration.png
    └── @-attach.png
```

## 1. Brand masters (root of `assets/`)

**Keep these paths stable.** Packaging and icon scripts hardcode them
(`quantum-build/icons/generate_quantum_assets.sh`, `prepare_icons.sh`, etc.).

| File | Purpose |
|------|---------|
| `Quantum.png` | Light UI mark (black on transparent) — letterpress, BMPs, docs |
| `Quantum-dark.png` | Dark UI mark (white on transparent) — letterpress-dark, `code-icon.svg` |
| `app-icon.png` | App icon source → `.icns` / `.ico` / Linux PNG / PWA |
| `app-icon-light.png` | Light-context app mark |
| `lockup-light.png` / `lockup-dark.png` | Icon + “QUANTUM” wordmark (transparent) |
| `lockup-horizontal-*.png` | Horizontal lockups copied into workbench media |
| `lockup-banner-*.png` | Lockup on solid plate (WiX / docs) |
| `banner-lockup-*.png` | Wide marketing banner variants |
| `Quantum_Name.png` | Wordmark-only glyph |

Regenerate derived icons: `quantum-build/icons/prepare_icons.sh`  
Details: [quantum-build/icons/README.md](../quantum-build/icons/README.md)

## 2. Marketing (`assets/marketing/`)

Banners and storefront art used by GitHub README / docs — **not** fed into the
app icon pipeline.

| File | Purpose |
|------|---------|
| `readme-banner.png` | README hero strip |

Add new README/site banners here (e.g. `og-image.png`, store tiles).

## 3. Screenshots (`assets/screenshots/`)

**This is where IDE product demos go** — agent panel, browser, settings, etc.

| File | Purpose |
|------|---------|
| `demo.png` | Primary hero screenshot (editor + Agent sidebar) |
| `agent-working-in-codebase.png` | Agent running tools against the open repo |
| `agent-browser-integration.png` | Embedded browser + element picker → chat |
| `@-attach.png` | `@` context attach menu |

### Adding a new screenshot

1. Capture the Quantum window (full IDE, no unrelated desktop chrome).
2. Save as PNG under `assets/screenshots/` with a clear name, e.g.:
   - `agent-chat.png`
   - `browser-element-picker.png`
   - `settings-models.png`
3. Reference it from the README:

```markdown
![Agent chat](./assets/screenshots/agent-chat.png)
```

Do **not** put screenshots next to brand masters at the `assets/` root, and do
**not** put logos in `screenshots/`.

## What does *not* belong here

| Location | What |
|----------|------|
| `src/vs/workbench/contrib/agent/gui/` Vite `assets/` | Built webview JS/CSS — generated, not brand art |
| `extensions/*/media/` | Per-extension icons |
| `quantum-build/` generated icons | Derived from the masters above — do not edit by hand |
| Cursor chat attachment folders | Local agent screenshots only — copy keepers into `screenshots/` if they belong in the repo |
