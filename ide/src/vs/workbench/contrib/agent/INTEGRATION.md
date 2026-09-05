# Quantum host integration

Agent source lives in this directory. The **built-in extension** is generated under repo-level `out/agent` and loaded from there. Product logic lives in `src/`, `core/`, `gui/`, `packages/`. Workbench host hooks outside this folder:

| Host file | Purpose |
|-----------|---------|
| `src/vs/platform/environment/common/environment.ts` | `builtinAgentExtensionPath` on `INativeEnvironmentService` |
| `src/vs/platform/environment/common/environmentService.ts` | Resolves path → `{appRoot}/out/agent` |
| `src/vs/platform/extensionManagement/common/extensionsScannerService.ts` | `scanBuiltinContribAgentExtension()` at system scan |
| `src/vs/workbench/workbench.common.main.ts` | Imports layout / webview hover / browser bridge contributions |
| `build/gulpfile.agent.ts` | `compile-agent` / `watch-agent` (packages + esbuild + GUI → `out/agent`) |
| `build/gulpfile.ts` | Wires agent into `compile` / `watch`; preserves `out/agent` on rimraf |
| `build/gulpfile.vscode.ts` | Packages `out/agent/**` into desktop builds |
| `build/lib/preLaunch.ts` | Ensures `out/agent` artifacts exist before launch |
| `build/next/index.ts` + `src/tsconfig.json` | Excludes Agent runtime from workbench transpile |

Everything else (activation, UI, commands, webview) is inside this extension.

## Commands for workbench integration

Call Agent via commands, not deep imports:

- `agent.openPanel` — show Agent sidebar
- `agent.focusAgentInput` — focus chat input (`Cmd/Ctrl+L`)
- `agent.browser.*` — integrated browser bridge (list/open/close pages, share, invoke Playwright tools)
- Agent browser tools (always available in Agent mode): `open_browser_page`, `list_open_pages`, `close_browser_page`, `read_page`, `screenshot_page`, `navigate_page`, click/type/hover/drag, `run_playwright_code`, `handle_dialog`

## Dev workflow (repo root)

```bash
./scripts/setup.sh --setup-only   # install + full compile (includes agent + extensions)
npm run compile-agent             # agent only
npm run watch                     # workbench + extensions + watch-agent
./scripts/code.sh                 # launch (or setup.sh --launch-only)
```

Agent has no separate `scripts/code.sh`; use the Quantum root workflow.
