# Version control — what belongs in git

This monorepo keeps **product code** and **shared team tooling config** in git. **Machine-local state**, **secrets**, and **build artifacts** stay out.

## Three ignore files (do not confuse them)

| File | Purpose |
| --- | --- |
| [`.gitignore`](../.gitignore) | **Commits** — what `git add` includes |
| [`.cursorignore`](../.cursorignore) | **Cursor index only** — search/agent context; never blocks git |
| [`.idea/.gitignore`](../.idea/.gitignore) | **JetBrains local state** inside an otherwise shared `.idea/` tree |

If something “won’t commit”, check `git check-ignore -v <path>`. A global `~/.gitignore` may ignore `.cursor/` or `.idea/`; this repo **re-whitelists** shared paths in `.gitignore` with `!.cursor/` and `!.idea/` first, then explicit `!` rules.

## Always commit (repository root)

| Path | Why |
| --- | --- |
| [`AGENTS.md`](../AGENTS.md) | Monorepo AI / contributor entrypoint |
| [`Quantum.code-workspace`](../Quantum.code-workspace) | Multi-root VS Code / Cursor workspace |
| [`.editorconfig`](../.editorconfig) | Cross-editor formatting baseline |
| [`.gitattributes`](../.gitattributes) | Line endings and binary marking |
| [`.cursorignore`](../.cursorignore) | Cursor index policy (team-aligned) |
| [`.cursor/rules/`](../.cursor/rules/) | Project Cursor rules |
| [`.cursor/mcp.json`](../.cursor/mcp.json) | Shared MCP server map (no secrets) |
| [`.vscode/settings.json`](../.vscode/settings.json) | Monorepo editor defaults |
| [`.vscode/tasks.json`](../.vscode/tasks.json) | Setup / verify / dev tasks |
| [`.vscode/launch.json`](../.vscode/launch.json) | Shared launch configs |
| [`.vscode/extensions.json`](../.vscode/extensions.json) | Recommended extensions |
| [`.idea/`](../.idea/) (whitelisted files) | JetBrains modules, code style, run configs |
| [`package.json`](../package.json), [`package-lock.json`](../package-lock.json) | Root orchestration (Turbo); not product deps |
| [`turbo.json`](../turbo.json), [`mise.toml`](../mise.toml), [`.npmrc`](../.npmrc) | Task graph and toolchain pins |
| [`scripts/monorepo-doctor.sh`](../scripts/monorepo-doctor.sh) | Monorepo health check |
| [`scripts/`](../scripts/) | Setup, verify, E2E |
| [`agent/`](../agent/), [`ide/`](../ide/), [`build/`](../build/), [`docs/`](../docs/) | Product and release sources |

Run `./scripts/verify-repo-config.sh` to confirm required root config paths exist and are **not** gitignored.

## Commit per product (inside trees)

| Area | Commit | Do not commit |
| --- | --- | --- |
| **Agent** (`agent/`) | Source, `package.json`, lockfiles, tests, [`agent/AGENTS.md`](../agent/AGENTS.md), [`.vscode/settings.json`](../agent/.vscode/settings.json) if present | `node_modules/`, `dist/`, `.env`, local `.quantum-*` dev homes |
| **IDE** (`ide/`) | Source, extensions, [`ide/.vscode/`](../ide/.vscode/) (full debug toolchain), lockfiles | `node_modules/`, `out/`, `out-build/`, `.build/`, `.vscode-test/` |
| **Web** (`web/`) | Site source when added | `node_modules/`, `.next/`, `dist/`, `.env` |
| **Docs** (`docs/`) | Documentation hub ([readme.md](readme.md)) | Generated `.astro/`, `.cache/` when a site build is added |

## Never commit

- **Secrets**: `.env`, `.env.*.local`, API keys, tokens, `~/.agent` user data
- **Dependencies**: `node_modules/`, `.bun/`, `.pnpm-store/`
- **Build outputs**: `dist/`, `out/`, `out-build/`, `out-vscode/`, `*.tsbuildinfo`
- **Personal IDE state**: `.idea/workspace.xml`, `.idea/shelf/`, most of root `.vscode/*` except the four whitelisted JSON files
- **OS junk**: `.DS_Store`, `Thumbs.db`

## Recommended workflow

1. Clone → open **`Quantum.code-workspace`** in VS Code or Cursor.
2. `./scripts/setup.sh` → `./scripts/verify.sh` (includes repo config check).
3. Work in `agent/` or `ide/`; follow that product’s `AGENTS.md`.
4. Before push: only stage intentional paths — `git status`, never `git add .` without review.

## Conventional Commits

`type(scope): summary` — e.g. `feat(agent): …`, `fix(ide): …`, `chore: sync editor workspace config`.

See [CONTRIBUTING.md](../CONTRIBUTING.md).
