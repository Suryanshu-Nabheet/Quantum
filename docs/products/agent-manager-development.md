# Agent Manager — development

Engineering guide for `agent/`.

**Agent instructions:** [`agent/AGENTS.md`](../../agent/AGENTS.md) (required reading for automated agents).

## Workspace layout

Bun workspaces (`agent/package.json`):

```
agent/
├── apps/desktop/     # Electron
├── apps/server/      # WebSocket server, provider managers, SQLite
├── apps/web/         # React UI
├── packages/contracts/   # Schemas only — no runtime logic
├── packages/shared/      # Shared utilities (@quantum/shared/*)
└── scripts/          # dev-runner, setup, verify
```

## Commands

```bash
cd agent
bun install
bun run dev              # Full dev stack
bun run dev:server
bun run dev:web
bun run dev:desktop
bun run build            # Production desktop build
bun run typecheck
bun run test             # Vitest — never use `bun test`
```

Monorepo verify: `../scripts/verify.sh` (includes `agent/scripts/verify.sh`).

## Architecture notes

- **Codex-first:** server spawns `codex app-server` (JSON-RPC over stdio) per provider session; events stream to the browser via WebSocket (`orchestration.domainEvent`, etc.).
- Key server modules (indicative): `codexAppServerManager.ts`, `providerManager.ts`, `wsServer.ts`.
- **Contracts** define the wire format — change schemas in `packages/contracts` and update server + web together.

## Local dev isolation

When running a **second** instance alongside your daily Quantum install:

- Use a dedicated `--home-dir` and non-default ports
- Unset inherited `QUANTUM_AUTH_TOKEN` unless the web app is configured to match
- See **Local Dev Instance Isolation** in [`agent/AGENTS.md`](../../agent/AGENTS.md)

## UI conventions

Shared disclosure/toggle motion: `apps/web/src/lib/disclosureMotion.ts` — do not add one-off toggle animations (documented in AGENTS.md).

## Verification before merge

When the user or task requires full validation:

```bash
bun run fmt    # only when requested or final pass
bun run lint
bun run typecheck
bun run test
```

Bundle into one final pass per task when possible (`agent/AGENTS.md`).

## Configuration

- Dev ports / env: see [`agent/README.md`](../../agent/README.md) and server startup logs
- Keybindings config format: [`agent/KEYBINDINGS.md`](../../agent/KEYBINDINGS.md)

## See also

- [Agent Manager product overview](agent-manager.md)
- [For contributors](../for-contributors.md)
