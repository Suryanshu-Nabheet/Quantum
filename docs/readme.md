# Quantum documentation

Central documentation for the **Quantum** monorepo: two products (IDE + Agent Manager), shared policies, and guides for humans and AI agents.

## Start here

| Audience | Document |
| --- | --- |
| New contributor | [Getting started](getting-started.md) |
| Day-to-day development | [For contributors](for-contributors.md) |
| AI agents (Cursor, IDE Agent, etc.) | [For agents](for-agents.md) |
| Git / editor / what to commit | [Version control](version-control.md) |

## Products

| Product | Overview | Development |
| --- | --- | --- |
| **Quantum IDE** | [Quantum IDE](products/quantum-ide.md) | [IDE development](products/quantum-ide-development.md) |
| **Workbench Agent** (in-IDE AI) | [Workbench Agent](products/workbench-agent.md) | [Agent harness reference](reference/workbench-agent-harness.md) |
| **Quantum Agent Manager** | [Agent Manager](products/agent-manager.md) | [Agent Manager development](products/agent-manager-development.md) |

## Architecture

| Topic | Document |
| --- | --- |
| Ecosystem topology | [Architecture overview](architecture/overview.md) |
| Privacy & local data | [Privacy and data](architecture/privacy-and-data.md) |
| Model Context Protocol | [MCP](architecture/mcp.md) |

## Reference

| Topic | Document |
| --- | --- |
| Monorepo directory map | [Monorepo map](reference/monorepo-map.md) |
| Agent turn / tool loop (maintainers) | [Workbench Agent harness](reference/workbench-agent-harness.md) |

## Canonical sources (live in tree)

These paths are the **source of truth** when docs and code diverge:

| Path | Contents |
| --- | --- |
| [`ide/README.md`](../ide/README.md) | IDE features, setup, packaging |
| [`ide/AGENTS.md`](../ide/AGENTS.md) | IDE + workbench agent workflow rules |
| [`ide/src/vs/workbench/contrib/agent/README.md`](../ide/src/vs/workbench/contrib/agent/README.md) | Agent layout, build, config, host integration |
| [`ide/.github/copilot-instructions.md`](../ide/.github/copilot-instructions.md) | VS Code layer rules, TypeScript validation |
| [`agent/README.md`](../agent/README.md) | Agent Manager product overview |
| [`agent/AGENTS.md`](../agent/AGENTS.md) | Agent Manager agent instructions |
| [`scripts/README.md`](../scripts/README.md) | Monorepo setup & verify |
| [`CONTRIBUTING.md`](../CONTRIBUTING.md) | Contribution policy |
| [`AGENTS.md`](../AGENTS.md) | Monorepo AI entrypoint |

## Repository layout (summary)

```
quantum/
├── agent/          # Agent Manager (Electron + Effect server + React web UI)
├── ide/            # Quantum IDE (VS Code fork + contrib/agent)
├── build/          # Release packaging (upstream VS Code → Quantum binaries)
├── docs/           # This documentation hub
├── eval/           # Workbench Agent regression (bun run eval)
├── scripts/        # ./scripts/setup.sh, verify.sh, e2e.sh
└── web/            # Public website (in progress)
```
