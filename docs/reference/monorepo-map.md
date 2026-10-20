# Monorepo map

Quick reference for top-level directories in [Suryanshu-Nabheet/Quantum](https://github.com/Suryanshu-Nabheet/Quantum).

| Path | Commit? | Purpose |
| --- | --- | --- |
| [`package.json`](../package.json) | Yes | Root orchestration (`@quantum/root`), Turbo, `npm run` entrypoints |
| [`turbo.json`](../turbo.json) | Yes | Task graph for `eval/` |
| [`mise.toml`](../mise.toml) | Yes | Canonical Bun / Node 24 pins |
| [`scripts/monorepo-doctor.sh`](../../scripts/monorepo-doctor.sh) | Yes | Layout, lockfiles, install state, git scale |
| [`agent/`](../../agent/) | Source yes | Agent Manager — Bun monorepo (server, web, desktop) |
| [`ide/`](../../ide/) | Source yes | Quantum IDE — VS Code fork + workbench agent |
| [`build/`](../../build/) | Source yes | Release packaging from upstream VS Code |
| [`docs/`](../../docs/) | Yes | Documentation hub (this tree) |
| [`scripts/`](../../scripts/) | Yes | `setup.sh`, `verify.sh`, `e2e.sh`, `verify-repo-config.sh` |
| [`eval/`](../../eval/) | Yes | Workbench Agent regression (`npm run eval` from root) |
| [`web/`](../../web/) | Source yes | Public website (scaffold) |
| [`.vscode/`](../../.vscode/) | Partial | Root workspace tasks/settings (whitelist) |
| [`.cursor/`](../../.cursor/) | Partial | Cursor rules + `mcp.json` |
| [`.idea/`](../../.idea/) | Partial | Shared JetBrains config (whitelist) |
| `node_modules/`, `out/`, `dist/` | **No** | Generated / installed |

## `ide/` internals (selected)

| Path | Purpose |
| --- | --- |
| `src/vs/workbench/contrib/agent/` | Quantum Workbench Agent (core AI engine: chat, inline edit, autocomplete, tools, MCP) |
| `src/vs/workbench/contrib/browserView/` | Embedded browser UI |
| `src/vs/platform/browserView/` | Browser platform services |
| `src/vs/workbench/contrib/chat/` | Upstream editor chat module (inactive; not used in Quantum) |
| `src/vs/workbench/contrib/inlineChat/` | Upstream editor inline chat module (inactive; not used in Quantum) |
| `src/vs/sessions/` | Upstream editor sessions module (inactive; not used in Quantum) |
| `ide/extensions/` | Built-in extensions (including `quantum-*`) |
| `build/gulpfile.agent.ts` | Agent compile pipeline |
| `out/agent/` | **Generated** built-in agent extension |

## `agent/` internals (selected)

| Path | Purpose |
| --- | --- |
| `apps/server/` | WebSocket + orchestration |
| `apps/web/` | React client |
| `apps/desktop/` | Electron |
| `packages/contracts/` | Shared schemas |
| `packages/shared/` | Shared runtime helpers |

## Entry documents

| Role | File |
| --- | --- |
| Human contributor | [CONTRIBUTING.md](../../CONTRIBUTING.md), [for-contributors.md](../for-contributors.md) |
| AI agent | [AGENTS.md](../../AGENTS.md), [for-agents.md](../for-agents.md) |
| Setup | [getting-started.md](../getting-started.md), [scripts/README.md](../../scripts/README.md) |
| Commits | [version-control.md](../version-control.md) |
