# Agent — Quantum IDE

Autonomous AI coding agent for **Quantum IDE** (VS Code–compatible editor). Chat, inline edit, tab autocomplete, and MCP-backed agents — BYOK providers, no Quantum cloud account.

**Part of:** [Quantum](https://github.com/Suryanshu-Nabheet/Quantum) · **Founder:** Suryanshu Nabheet

## Layout

```
src/vs/workbench/contrib/agent/   # source (this directory)
├── src/            # extension host
├── core/           # LLM, tools, context providers, config
├── gui/            # React sidebar (Vite)
├── workbench/      # Quantum workbench integration (layout, hovers)
├── shared/         # extension + view IDs (workbench + host)
├── packages/       # shared libraries
└── scripts/        # build helpers for the generated Agent runtime
```

Quantum builds this source into `out/agent` and loads that generated folder as a built-in system extension (no `extensions/agent` symlink).

## Build (from Quantum repo root)

```bash
npm run compile    # includes agent via gulp compile-agent
npm run watch      # includes agent esbuild watch
./scripts/setup.sh --setup-only
```

## GUI live reload

Default: `npm run watch` at repo root rebuilds the GUI into `out/agent/webview/` (no second terminal).

Optional Vite HMR: set **Agent: Use Vite Gui Dev Server** to `true`, then:

```bash
npm run dev --prefix gui
```

## Configuration

Open **Quantum Settings** from the title bar layout menu (gear → Quantum Settings) or **Agent: Open Settings**. All user settings are stored in `~/.agent/index/globalContext.json` — models, rules, prompts, and MCP servers. There is no `config.yaml` or user `config.json`.

- **Models** — add / configure / remove providers (one trash removes the model everywhere)
- **Model roles** — assign which model chat, autocomplete, edit, apply, embed, and rerank use
- **Browser** — Agent tools drive the integrated browser (list/open/close tabs, navigate, click, type, screenshot, Playwright)
- **Rules, Tools, MCP**
- Secrets: `~/.agent/.env` or workspace `.env`
- **Project rules** — `AGENTS.md` / `AGENT.md` / `CLAUDE.md` in the workspace root

User data: `~/.agent/` (settings, sessions, index, embedding models cache).

### Local storage (no cloud database)

Agent does **not** use a remote database or account. All persistence is on disk:

| Path | Purpose |
|------|---------|
| `~/.agent/index/globalContext.json` | Models, rules, MCP, prompts |
| `~/.agent/sessions/` | Chat history |
| `~/.agent/models/` | Cached embedding models (transformers.js) |
| `~/.agent/exports/` | Session markdown exports when workspace is remote |

## Design

- **Quantum-only host** — built into the workbench, no multi-IDE adapters
- **BYOK** — you bring API keys / local models; no Quantum cloud account or product telemetry
- Optional cloud LLM providers (OpenAI, Anthropic, OpenRouter, etc.) when you configure them
- Embedding models cache under `~/.agent/models` (transformers.js may download once on first use)
- GUI-first setup + MCP for tools / external docs

## Quantum IDE integration

Agent source already lives in the Quantum monorepo. Build and launch from the repo root:

```bash
npm run compile
VSCODE_SKIP_PRELAUNCH=1 ./scripts/code.sh
```

**Generated runtime** (created at build time — not committed):

| Path | Role |
|------|------|
| `out/agent/out/extension.js` | Bundled extension entry (`package.json` → `main`) |
| `out/agent/webview/` | Production sidebar UI (from `out/agent-gui`) |

**Not shipped** (source / cache only): `src/`, `core/`, `gui/`, `packages/`, `scripts/`, `tmp/`, `.npm-cache/`.

Remove local build artifacts before copying source:

```bash
npm run clean
```

Agent UI is lazy. Lightweight tab autocomplete is registered on startup and enabled by default so editor suggestions work without opening the sidebar.

### Manual acceptance

After `npm run compile`, open Quantum with `./scripts/code.sh` from the repo root and confirm:

1. `@file`, `@folder`, `@search`, `@rules`, `@commit`, and `@branch` return sensible results
2. Chat, edit, and tab autocomplete work after an extension reload
3. Agent terminal tool captures `echo hello` output
4. Settings toggles persist after reload

## Quality checks (from Quantum repo root)

```bash
npm run compile-agent   # packages + webview + esbuild → out/agent
npm run compile         # full workbench + extensions + agent
```

From this directory (optional): `npm run tsc:check`, `npm test`, `npm run build:agent`.

## License

MIT — see [LICENSE](LICENSE).
