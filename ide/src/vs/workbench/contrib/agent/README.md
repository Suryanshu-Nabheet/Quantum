# Agent — Quantum IDE

Autonomous AI coding agent for **Quantum IDE** (VS Code–compatible editor). Chat, inline edit, tab autocomplete, and MCP-backed agents — BYOK providers, no Quantum cloud account.

**Part of:** [Quantum](https://github.com/Suryanshu-Nabheet/Quantum) · **Founder:** Suryanshu Nabheet

**Docs (monorepo):** [docs/products/workbench-agent.md](../../../../../../docs/products/workbench-agent.md) · [docs/reference/workbench-agent-harness.md](../../../../../../docs/reference/workbench-agent-harness.md)

## Layout

```
src/vs/workbench/contrib/agent/   # source (this directory)
├── core/           # LLM, tools, context providers, config
├── gui/            # React sidebar (Vite)
├── workbench/      # Native Quantum workbench integration and runtime bridge
├── shared/         # Agent view and protocol IDs
├── packages/       # shared libraries
└── scripts/        # build helpers for the generated Agent runtime
```

Quantum builds the native runtime and GUI into `ide/out/agent`. The workbench owns the view, commands, autocomplete provider, and runtime lifecycle; this directory is not registered or loaded as an extension.

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
| `watch-gui.js` | Typecheck and rebuild GUI changes, then refresh `out/agent/webview/` under gulp `watch-agent` |
| `watch-packages.js` | Watch local packages (gulp `watch-agent`) |
| `esbuild.js` | Bundle native runtime worker and runtime into `out/agent/runtime/` |
| `copy-native-assets.js` | Copy onnxruntime/tokenizers/workers into `out/agent` |
| `clean-artifacts.js` | `npm run clean` — local caches + `out/agent*` |

Production agent build from here: `npm run build:agent`.

## GUI development and builds

Use the IDE's normal `npm run watch` command. Its `watch-agent` task watches the Agent GUI and copies completed bundles into `out/agent/webview/`, which the workbench loads. Reopen the Agent webview after a GUI rebuild to load the updated local bundle.

`npm run compile-agent` checks GUI source timestamps and rebuilds stale output before copying it into the workbench webview. The GUI production build is `npm run build --prefix gui` → `out/agent-gui/`.

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
| `src/vs/platform/environment/common/environment.ts` | `agentRuntimePath` on `INativeEnvironmentService` |
| `src/vs/platform/environment/common/environmentService.ts` | Resolves runtime assets → `{appRoot}/out/agent` |
| `src/vs/platform/extensionManagement/common/extensionsScannerService.ts` | No Agent extension scanning; Agent is workbench-owned |
| `src/vs/workbench/workbench.common.main.ts` | Native view, actions, webview hover, and browser contributions |
| `build/gulpfile.agent.ts` | `compile-agent` / `watch-agent` |
| `build/gulpfile.ts` | Wires agent into `compile` / `watch` |
| `build/lib/preLaunch.ts` | Ensures `out/agent` exists before launch |
| `src/tsconfig.json` | Excludes separately built Agent runtime from workbench transpile |

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
| `out/agent/runtime/agentRuntimeWorker.js` | Native Agent execution worker |
| `out/agent/webview/` | Production sidebar UI |

Tab autocomplete registers on startup (default on) without opening the sidebar.

### Manual acceptance

After `npm run compile`, confirm:

1. `@file`, `@folder`, `@search`, `@rules`, `@commit`, `@branch` work
2. Chat, edit, and tab autocomplete after IDE relaunch
3. Terminal tool captures `echo hello`
4. Settings toggles persist after reload

## Agent harness (maintainers)

Chat/tool turns: `runAgentDriver` in `streamModelTurn` → `withAgentStreamLock` → tool policy → parallel tools → next driver iteration.

- One LLM stream at a time: `withAgentStreamLock` on `runStreamModelTurnLocked`
- **Stream continuation:** only inside `core/llm/streamChat.ts` (up to 3 segments when truncated or clearly cut off — no extra GUI re-stream loops)
- Step depth resets per user message; tools at `depth + 1`
- Mixed approval: auto tools do not auto-resume the LLM
- IPC: long timeouts for `tools/call` and `llm/assembleChat`

**Reliability invariants:** one terminal outcome per stream; abortable streams; bounded errors instead of spinners; `ensureAgentTurnInactive` when the driver exits; invalid tool JSON surfaces as errors, not execution. Prefer deleting eager imports and duplicate listeners over new orchestration layers.

**Local Ollama `*coder*` models:** use ` ```tool ` system-message tools (not native `tool_calls`). If the model still prints ` ```json ` tool JSON, post-stream recovery in `markdownJsonToolCall.ts` turns it into a real tool call once.

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
npm run eval:harness   # monorepo eval cases (or: cd ../../../../../eval && bun run eval)
```

Known test baselines (do not increase failure count): core — 1 failure in `runTerminalCommand.vitest.ts`; gui — 14 failures in `streamResponse*.test.ts`.

## License

MIT — see [LICENSE](LICENSE).
