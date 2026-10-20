# For contributors

How to work in the Quantum monorepo without crossing product boundaries.

## Choose your product

| You are changing… | Work in | Read first |
| --- | --- | --- |
| Editor, workbench, built-in agent UI/tools | `ide/` | [IDE development](products/quantum-ide-development.md), [`ide/AGENTS.md`](../ide/AGENTS.md) |
| Workbench Agent only (`contrib/agent`) | `ide/src/vs/workbench/contrib/agent/` | [Workbench Agent](products/workbench-agent.md) |
| Desktop orchestration, Spaces, Codex sessions | `agent/` | [Agent Manager development](products/agent-manager-development.md), [`agent/AGENTS.md`](../agent/AGENTS.md) |
| Release binaries (branded VS Code) | `build/` | [`build/docs/`](../build/docs/) |
| Monorepo scripts, docs hub | `scripts/`, `docs/` | [Version control](version-control.md) |

Do **not** import `agent/` from `ide/` or vice versa. Shared policy lives at the repo root only.

> [!IMPORTANT]
> **AI Architecture & Code Location**
> All agentic AI features in Quantum IDE (chat UI, inline edit, tab autocomplete, MCP, tool execution) are implemented in **`ide/src/vs/workbench/contrib/agent/`**.
>
> Upstream Microsoft Copilot directories (`src/vs/workbench/contrib/chat`, `src/vs/workbench/contrib/inlineChat`, `src/vs/sessions`, and `src/vs/platform/chat`) are legacy upstream modules not utilized in Quantum. Never direct AI features, tool implementations, or fixes to those directories.

## Setup and verification

```bash
./scripts/setup.sh
./scripts/verify.sh
```

Product-specific checks:

```bash
cd agent && bun run typecheck    # when touching agent/
cd ide && npm run tsc:check      # when touching ide/src (see copilot-instructions)
```

Workbench Agent maintainers: see [Workbench Agent harness](reference/workbench-agent-harness.md) and `npm run verify` inside `contrib/agent`.

## Editor workflow

1. Open [`Quantum.code-workspace`](../Quantum.code-workspace).
2. Use **Tasks**: `Quantum: Setup`, `Quantum: Verify`, `Agent: dev stack`, `IDE: watch`.
3. IDE **F5** debug configs: `ide/.vscode/` (not root).

## Commits

- [Conventional Commits](https://www.conventionalcommits.org/): `feat(ide): …`, `fix(agent): …`, `docs: …`
- [What to commit](version-control.md) — never commit `.env`, `node_modules/`, `out/`, `dist/`
- Full policy: [`CONTRIBUTING.md`](../CONTRIBUTING.md)

## Code style

| Area | Indent | Reference |
| --- | --- | --- |
| `ide/` (VS Code core) | Tabs | [`ide/.github/copilot-instructions.md`](../ide/.github/copilot-instructions.md) |
| `agent/` | 2 spaces | [`agent/AGENTS.md`](../agent/AGENTS.md), root [`.editorconfig`](../.editorconfig) |
| `docs/` | 2 spaces | `.editorconfig` |

## Security and privacy

No new telemetry or non-consensual network calls. See [Privacy and data](architecture/privacy-and-data.md) and [`SECURITY.md`](../SECURITY.md).

## Help

- [Getting started](getting-started.md)
- [Monorepo map](reference/monorepo-map.md)
- Issues: GitHub with repro steps and logs
