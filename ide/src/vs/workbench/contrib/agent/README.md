# Agent — Quantum IDE

Autonomous AI coding agent for **Quantum IDE** (VS Code–compatible editor). Chat, inline edit, tab autocomplete, and MCP-backed agents — BYOK providers, no Quantum cloud account.

**Part of:** [Quantum](https://github.com/Suryanshu-Nabheet/Quantum) · **Founder:** Suryanshu Nabheet

## Layout

```
src/vs/workbench/contrib/agent/   # source (this directory)
├── src/            # extension host
├── core/           # LLM, tools, context providers, config
├── gui/            # React sidebar (Vite)
├── workbench/      # Quantum workbench integration (layout, hovers, browser)
├── shared/         # extension + view IDs (workbench + host)
├── packages/       # shared libraries
└── scripts/        # build helpers for the generated Agent runtime
```

Quantum builds this source into `ide/out/agent` and loads that folder as a built-in system extension (`quantum.agent`). There is no `extensions/agent` symlink.

## Build (from `ide/` repo root)

```bash
npm run compile    # includes agent via gulp compile-agent
npm run watch      # includes agent esbuild watch
./scripts/setup.sh --setup-only
```

### Build scripts (this directory)

| Script | Purpose |
|--------|---------|
| `build-packages.js` | Build `packages/*` in dependency order → `out/agent-packages` |
| `ensure-webview.js` | Build/copy GUI into `out/agent/webview/` |
| `watch-gui.js` | Watch GUI; refresh `out/agent/webview/` (gulp `watch-agent`) |
| `watch-packages.js` | Watch local packages (gulp `watch-agent`) |
| `esbuild.js` | Bundle `src/` + `core/` → `out/agent/out/extension.js` |
| `copy-native-assets.js` | Copy onnxruntime/tokenizers/workers into `out/agent` |
| `clean-artifacts.js` | `npm run clean` — local caches + `out/agent*` |

Production agent build from here: `npm run build:agent`.

## GUI live reload

Default: `npm run watch` at the `ide/` root rebuilds the GUI into `out/agent/webview/` (no second terminal).

Optional Vite HMR: set **Agent: Use Vite Gui Dev Server** to `true`, then from this directory:

```bash
npm run dev --prefix gui
```

GUI production build: `npm run build --prefix gui` → `out/agent-gui/`, copied by `ensure-webview.js` during `compile-agent`.

## Configuration

Open **Settings** with **⌘,** / **Ctrl+,**. Workbench preferences: **VS Code Settings** (**⌘⇧,** / **Ctrl+Shift+,**). Agent config lives in `~/.agent/index/globalContext.json` — models, rules, prompts, and MCP servers.

- **Models** — add / configure / remove providers (one card per provider)
- **Agent** — model, permissions, protected paths, loop limits; optional embed/rerank
- **Tab** — Tab model and ignored paths for inline completions
- **Browser** — integrated browser tools (tabs, navigate, click, type, screenshot, Playwright)
- **Rules** and **MCP**
- Secrets: `~/.agent/.env` or workspace `.env`
- **Project rules** — `AGENTS.md` / `AGENT.md` / `CLAUDE.md` in the workspace root

User data: `~/.agent/` (settings, sessions, index, embedding models cache).

### Local storage (no cloud database)

| Path | Purpose |
|------|---------|
| `~/.agent/index/globalContext.json` | Models, rules, MCP, prompts |
| `~/.agent/sessions/` | Chat history |
| `~/.agent/models/` | Cached embedding models (transformers.js) |
| `~/.agent/exports/` | Session markdown exports when workspace is remote |

## Design

- **Quantum-only host** — built into the workbench, no multi-IDE adapters
- **BYOK** — API keys / local models; no Quantum cloud account or product telemetry
- GUI-first setup + MCP for tools / external docs

## Quantum workbench integration

Host hooks **outside** this folder (edit only when changing how Agent is loaded or laid out):

| Host file | Purpose |
|-----------|---------|
| `src/vs/platform/environment/common/environment.ts` | `builtinAgentExtensionPath` on `INativeEnvironmentService` |
| `src/vs/platform/environment/common/environmentService.ts` | Resolves path → `{appRoot}/out/agent` |
| `src/vs/platform/extensionManagement/common/extensionsScannerService.ts` | `scanBuiltinContribAgentExtension()` |
| `src/vs/workbench/workbench.common.main.ts` | Layout, webview hover, browser bridge contributions |
| `build/gulpfile.agent.ts` | `compile-agent` / `watch-agent` |
| `build/gulpfile.ts` | Wires agent into `compile` / `watch` |
| `build/lib/preLaunch.ts` | Ensures `out/agent` exists before launch |
| `src/tsconfig.json` | Excludes Agent runtime from workbench transpile |

Integrate from the shell via **commands**, not deep imports into `core/` or `gui/`:

- `agent.openPanel`, `agent.focusAgentInput` (**Cmd/Ctrl+L**)
- `agent.browser.*` — workbench browser bridge
- Browser tools (core): `open_browser_page`, `list_open_pages`, `close_browser_page`, `read_page`, `screenshot_page`, `navigate_page`, click/type/hover/drag, `run_playwright_code`, `handle_dialog`

Launch from `ide/`:

```bash
npm run compile
VSCODE_SKIP_PRELAUNCH=1 ./scripts/code.sh
```

**Generated runtime** (not committed):

| Path | Role |
|------|------|
| `out/agent/out/extension.js` | Bundled extension entry |
| `out/agent/webview/` | Production sidebar UI |

Tab autocomplete registers on startup (default on) without opening the sidebar.

### Manual acceptance

After `npm run compile`, confirm:

1. `@file`, `@folder`, `@search`, `@rules`, `@commit`, `@branch` work
2. Chat, edit, and tab autocomplete after extension reload
3. Terminal tool captures `echo hello`
4. Settings toggles persist after reload

## Agent harness (maintainers)

Chat/tool turns: `streamNormalInput` → tool policy → parallel tools → `streamResponseAfterToolCall` → next turn.

- One LLM stream: `withAgentStreamLock` on `streamNormalInput`
- Step depth resets per user message; tools at `depth + 1`
- Mixed approval: auto tools do not auto-resume the LLM
- IPC: long timeouts for `tools/call` and `llm/compileChat`

**Reliability invariants:** one terminal outcome per stream; abortable streams; bounded errors instead of spinners; no replay of partially executed turns without deduplicating side effects. Prefer deleting eager imports and duplicate listeners over new orchestration layers.

Full workflow rules: `ide/AGENTS.md`.

## Quality checks

From `ide/` root:

```bash
npm run compile-agent
npm run compile
```

From this directory:

```bash
npm run tsc:check
npm test
npm run build:agent
npm run verify   # full matrix (core, gui, packages)
```

Known test baselines (do not increase failure count): core — 1 failure in `runTerminalCommand.vitest.ts`; gui — 14 failures in `streamResponse*.test.ts`.

## License

MIT — see [LICENSE](LICENSE).
