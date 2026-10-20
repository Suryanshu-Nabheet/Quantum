# Workbench Agent (IDE built-in agent)

The **Workbench Agent** is Quantum’s first-party AI coding agent embedded in the IDE — not a marketplace extension. Source lives under:

**`ide/src/vs/workbench/contrib/agent/`**

Canonical technical README: [`contrib/agent/README.md`](../../ide/src/vs/workbench/contrib/agent/README.md)

## Purpose

- Chat, inline edit, tab autocomplete, tool execution, MCP
- **BYOK** — user API keys and local models; no Quantum cloud account required for core flows
- **Local-first** — settings and sessions on disk under `~/.agent/`

## Architectural Scope

> [!IMPORTANT]
> **Primary AI Engine:**
> `ide/src/vs/workbench/contrib/agent/` serves as the exclusive engine for all AI features in Quantum IDE.
>
> Quantum operates independently of upstream Microsoft Copilot infrastructure (`src/vs/workbench/contrib/chat`, `src/vs/workbench/contrib/inlineChat`, `src/vs/sessions`, and `src/vs/platform/chat`). All agentic workflows, conversational interfaces, tool policies, model provider adapters, MCP integrations, inline code generation, and autocomplete systems are centralized in `contrib/agent/`. Feature development and fixes must not target upstream chat directories.

## Directory layout

```
contrib/agent/
├── src/           # Extension host entry (bundled to out/agent/out/extension.js)
├── core/          # LLM clients, tools, context providers, config, indexing
├── gui/           # React sidebar (Vite → out/agent/webview/)
├── workbench/     # Workbench integration (layout, browser bridge, hovers)
├── shared/        # Shared IDs for workbench + host
├── packages/      # agent-config, fetch, llm-info, openai-adapters, terminal-security, …
└── scripts/       # esbuild, ensure-webview, watch-gui, build-packages
```

Quantum compiles this tree into **`ide/out/agent/`** and loads it as built-in extension **`quantum.agent`**. There is no `extensions/agent` symlink.

## Build

From `ide/`:

```bash
npm run compile        # includes compile-agent
npm run compile-agent  # agent only
npm run watch          # includes agent watchers
```

From `contrib/agent/`:

```bash
npm run build:agent
npm run verify         # core + gui + packages matrix
npm run eval:harness   # replay eval transcripts (see ../../../eval/)
```

Monorepo regression suite (harness + fixture cases):

```bash
npm run eval   # from repository root (turbo)
```

See [eval/README.md](../../../eval/README.md).

Generated artifacts (not committed):

| Path | Role |
| --- | --- |
| `out/agent/out/extension.js` | Extension host bundle |
| `out/agent/webview/` | Production sidebar UI |
| `out/agent-packages/` | Built local packages |

## Configuration (runtime)

| Location | Contents |
| --- | --- |
| `~/.agent/index/globalContext.json` | Models, rules, MCP, prompts |
| `~/.agent/sessions/` | Chat history |
| `~/.agent/models/` | Cached embedding models |
| `~/.agent/.env` | Secrets (optional) |
| Workspace `AGENTS.md` / `AGENT.md` / `CLAUDE.md` | Project rules |

IDE **Agent Settings** UI: models, agent permissions, tab autocomplete, browser tools, rules, MCP.

Optional GUI HMR: enable **Agent: Use Vite Gui Dev Server**, then `npm run dev --prefix gui`.

## Workbench host integration

Host code **outside** `contrib/agent/` wires the built-in extension:

| File | Role |
| --- | --- |
| `platform/environment/...` | `builtinAgentExtensionPath` → `{appRoot}/out/agent` |
| `extensionManagement/.../extensionsScannerService.ts` | `scanBuiltinContribAgentExtension()` |
| `workbench/workbench.common.main.ts` | Layout, webview, browser contributions |
| `build/gulpfile.agent.ts` | Gulp `compile-agent` / `watch-agent` |

Prefer **commands** (`agent.openPanel`, `agent.focusAgentInput`, `agent.browser.*`) over deep imports from `core/` or `gui/` in workbench code.

## Browser tools

Integrated with `browserView` / platform browser stack. Core tools include navigate, snapshot, click, type, screenshot, Playwright execution — see README in contrib for command IDs.

## Maintainer workflow

1. Read [`ide/AGENTS.md`](../../ide/AGENTS.md) (mandatory verification + desktop smoke).
2. Read [Workbench Agent harness](../reference/workbench-agent-harness.md) for turn-loop invariants.
3. Run `npm run verify` in `contrib/agent/` before committing harness changes.

## Quality baselines

Known pre-existing test failures (do not increase counts): see [`ide/AGENTS.md`](../../ide/AGENTS.md) and [`contrib/agent/README.md`](../../ide/src/vs/workbench/contrib/agent/README.md).

## See also

- [Quantum IDE](quantum-ide.md)
- [MCP](../architecture/mcp.md)
- [Privacy and data](../architecture/privacy-and-data.md)
