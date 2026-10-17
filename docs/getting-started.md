# Getting started

One monorepo, two products. This guide gets you from clone to a running IDE and Agent Manager.

## Prerequisites

| Tool | Agent Manager | Quantum IDE |
| --- | --- | --- |
| [Bun](https://bun.sh) | ≥ 1.3.9 | — |
| [Node.js](https://nodejs.org) | ≥ 24 | **22.22.1** ([`ide/.nvmrc`](../ide/.nvmrc)) |
| npm | — | Required, **&lt; 11.2** |
| Python | — | 3.10–3.13 (3.11 recommended on macOS) |
| C/C++ toolchain | — | Xcode CLT / build-essential / VS Build Tools |

Use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) for Node. See [`scripts/README.md`](../scripts/README.md) for troubleshooting.

## Clone and setup

```bash
git clone https://github.com/Suryanshu-Nabheet/Quantum.git
cd Quantum
./scripts/setup.sh
```

Windows: `scripts\setup.bat`

This installs and builds **Agent Manager**, then compiles **IDE** (longest step on first run).

## Verify

```bash
./scripts/verify.sh              # Repo config + product artifacts
./scripts/verify-repo-config.sh  # Editor/git policy only (fast)
cd eval && bun run eval          # Workbench Agent regression (harness, no API keys)
```

## Open the workspace

In VS Code or Cursor, open **[`Quantum.code-workspace`](../Quantum.code-workspace)** (multi-root: root, `agent/`, `ide/`, `docs/`, `build/`, `eval/`).

## Run the products

| Product | Command | Notes |
| --- | --- | --- |
| **Agent Manager** | `cd agent && bun run dev` | Web + server + optional desktop |
| **Quantum IDE** | `cd ide && ./scripts/code.sh` | After compile |
| **IDE + live rebuild** | Terminal 1: `cd ide && npm run watch` · Terminal 2: `VSCODE_SKIP_PRELAUNCH=1 ./scripts/code.sh` | Reload window when extension host changes |

Setup flags: `./scripts/setup.sh --skip-ide`, `--skip-agent`, `--launch-ide`, `--launch-agent` — see [`scripts/README.md`](../scripts/README.md).

## Configure AI (IDE)

- User data: `~/.quantum` (dev builds may use `~/.quantum-dev` — see `product.json`)
- Agent config: `~/.agent/index/globalContext.json` (models, rules, MCP)
- Secrets: `~/.agent/.env` or workspace `.env` (never commit)

Open Agent **Settings** in the IDE (⌘, / Ctrl+,) for models, tools, rules, and MCP.

## Next steps

- [For contributors](for-contributors.md) — which tree to edit, verification, commits
- [For agents](for-agents.md) — which `AGENTS.md` to follow
- [Quantum IDE](products/quantum-ide.md) · [Agent Manager](products/agent-manager.md) · [Workbench Agent](products/workbench-agent.md)
