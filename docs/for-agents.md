# For AI agents

Routing guide for automated coding agents (Cursor, IDE Workbench Agent, CI bots).

## Which instructions file?

| Scope | File | When |
| --- | --- | --- |
| **Monorepo** | [`AGENTS.md`](../AGENTS.md) | Default at repo root; boundaries and setup |
| **Quantum IDE** | [`ide/AGENTS.md`](../ide/AGENTS.md) | Any change under `ide/` |
| **Workbench Agent** | [`ide/AGENTS.md`](../ide/AGENTS.md) + [`contrib/agent/README.md`](../ide/src/vs/workbench/contrib/agent/README.md) | `ide/src/vs/workbench/contrib/agent/**` |
| **Agent Manager** | [`agent/AGENTS.md`](../agent/AGENTS.md) | Any change under `agent/` |

Cursor project rules: [`.cursor/rules/quantum-monorepo.mdc`](../.cursor/rules/quantum-monorepo.mdc).

## Documentation map

| Task | Read |
| --- | --- |
| Clone, setup, run | [Getting started](getting-started.md) |
| Git / commit policy | [Version control](version-control.md) |
| IDE architecture | [Quantum IDE](products/quantum-ide.md) |
| Agent sidebar, tools, MCP in IDE | [Workbench Agent](products/workbench-agent.md) |
| Agent turn loop (maintainers) | [Workbench Agent harness](reference/workbench-agent-harness.md) |
| Agent Manager server/UI | [Agent Manager](products/agent-manager.md) |
| VS Code layering / tsc | [`ide/.github/copilot-instructions.md`](../ide/.github/copilot-instructions.md) |

## Monorepo orchestration (root)

- **Dual install is intentional:** `ide/` = npm, `agent/` = Bun. Do not merge into one workspace `node_modules`.
- **Root:** `package.json`, `turbo.json`, `mise.toml` — run `./scripts/setup.sh` or `npm run setup` after `npm ci`.
- Doctor: `scripts/monorepo-doctor.sh` (not product TS). Details: [Monorepo orchestration](architecture/monorepo-orchestration.md).

## Hard rules (all products)

1. **No secrets in git** — `.env`, API keys, tokens.
2. **No telemetry** — do not add analytics or undisclosed network calls.
3. **Stay in product tree** — do not couple `agent/` and `ide/` codebases.
4. **Verify before claiming done** — run the checks listed in the product `AGENTS.md`.
5. **All IDE AI changes belong exclusively in `ide/src/vs/workbench/contrib/agent/`** — All IDE AI capabilities reside solely in this directory. Upstream VS Code Copilot modules (`src/vs/workbench/contrib/chat`, `src/vs/workbench/contrib/inlineChat`, `src/vs/sessions`, `src/vs/platform/chat`) are dormant upstream artifacts not used by Quantum.

## Workbench Agent (quick maintainer facts)

Source: `ide/src/vs/workbench/contrib/agent/`

- **Sole IDE AI engine:** Powers conversational chat, inline editing, multi-file diff application, tab autocomplete, tools, and MCP.
- **Turn loop:** `streamModelTurn` → tool policy → parallel tools → `streamResponseAfterToolCall` → repeat.
- **One LLM stream** at a time (`withAgentStreamLock`).
- **Build output:** `ide/out/agent/` (generated; not committed).
- **Config on disk:** `~/.agent/index/globalContext.json`, sessions under `~/.agent/sessions/`.

Details: [Workbench Agent harness](reference/workbench-agent-harness.md).

## Agent Manager (quick maintainer facts)

- **Stack:** Bun, Effect-TS server, React (`apps/web`), Electron (`apps/desktop`).
- **Contracts:** `packages/contracts` (schemas only).
- **Tests:** `bun run test` (never `bun test`).
- **Isolation:** use separate `--home-dir` and ports when running a second instance — see `agent/AGENTS.md`.

## Verify repo config after tooling changes

```bash
./scripts/verify-repo-config.sh
```
