# Privacy and data

Quantum is designed for **local-first** development: your code, credentials, and session state stay on the machine unless **you** configure outbound API or MCP endpoints.

## Principles

1. **No product telemetry** — Microsoft telemetry removed at source in the IDE fork; do not add undisclosed analytics in either product.
2. **User-controlled network** — LLM calls go to providers the user configures; MCP servers are user-declared.
3. **Secrets never in git** — `.env`, API keys, tokens (see [Version control](../version-control.md)).

## Typical on-disk locations

| Product | Path | Contents |
| --- | --- | --- |
| **IDE** | `~/.quantum` (see `product.json`; dev may use `~/.quantum-dev`) | VS Code–style settings, extensions, UI state |
| **Workbench Agent** | `~/.agent/` | `index/globalContext.json`, `sessions/`, embedding cache, optional `.env` |
| **Agent Manager** | Quantum home dir (CLI `--home-dir`) | SQLite state, projects, threads, local config |

Exact paths can vary by platform and dev flags — treat tables as defaults, not exhaustive.

## Workbench Agent storage

| Path | Purpose |
| --- | --- |
| `~/.agent/index/globalContext.json` | Models, rules, MCP registry, prompts |
| `~/.agent/sessions/` | Chat transcripts |
| `~/.agent/models/` | Downloaded embedding models (transformers.js) |
| `~/.agent/exports/` | Markdown exports when workspace is remote |

## Agent Manager storage

Server persists orchestration state locally (e.g. `state.sqlite` under the configured home directory). WebSocket auth may use `QUANTUM_AUTH_TOKEN` in dev — do not commit tokens.

## Reporting security issues

See [`SECURITY.md`](../../SECURITY.md).

## See also

- [Workbench Agent](../products/workbench-agent.md#configuration-runtime)
- [Architecture overview](overview.md)
