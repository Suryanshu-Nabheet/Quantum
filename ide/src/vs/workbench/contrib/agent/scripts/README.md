# Scripts

| Script | Purpose |
|--------|---------|
| `build-packages.js` | Build `packages/*` in dependency order |
| `clean-artifacts.js` | Remove build outputs, `node_modules`, and caches |
| `esbuild.js` | Bundle `src/` + `core/` into `out/agent/out/extension.js` |
| `ensure-webview.js` | Build/copy GUI assets into `out/agent/webview/` |
| `copy-native-assets.js` | Copy runtime binaries/assets into `out/agent/` |

## Dev host (GUI)

After `npm run watch` from the Quantum repo root, the sidebar uses bundled `out/agent/webview/` by default. Set **Agent: Use Vite Gui Dev Server** to `true` and run `npm run dev --prefix gui` from `contrib/agent` for live HMR from `http://localhost:5173`.

## Runtime build

```bash
npm run build:agent
```

```bash
VSCODE_SKIP_PRELAUNCH=1 ./scripts/code.sh
```
