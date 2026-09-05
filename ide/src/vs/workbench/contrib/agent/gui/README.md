# Agent GUI

React sidebar for the Quantum IDE Agent. Built with Vite; production builds are copied into repo-level `out/agent/webview/`.

## Development

From the agent directory (`src/vs/workbench/contrib/agent`):

```bash
npm run dev --prefix gui
```

Set **Agent: Use Vite Gui Dev Server** (`agent.useViteGuiDevServer`) to `true` in Quantum settings for live HMR from `http://localhost:5173`.

The extension uses the bundled `out/agent/webview/` by default after `npm run compile` at the Quantum repo root.

## Production build

```bash
npm run build --prefix gui
```

Output goes to repo-level `out/agent-gui/`, then copied to `out/agent/webview/` by `scripts/ensure-webview.js` during `gulp compile-agent`.
