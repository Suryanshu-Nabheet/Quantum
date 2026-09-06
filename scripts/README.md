# Quantum Monorepo Scripts

Production-grade setup and verification for all three Quantum subsystems.

## Quick start

| Platform | Command |
|----------|---------|
| macOS / Linux | `./scripts/setup.sh` |
| Windows | `scripts\setup.bat` |

Full setup installs dependencies and builds **CLI → Agent Manager → IDE** (fastest to slowest). The IDE compile step is the longest; expect several minutes on first run.

## Prerequisites

| Tool | CLI | Agent Manager | IDE |
|------|-----|---------------|-----|
| [Bun](https://bun.sh) | >= 1.3.9 | >= 1.3.9 | — |
| Node.js | >= 22 | >= 24 (see `agent/package.json`) | **22.22.1** (`.nvmrc`) |
| npm | — | — | required, **< 11.2** |
| Python | — | — | 3.10–3.13 (native modules) |

Recommended: install [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) for IDE Node version management, and [mise](https://mise.jdx.dev) for Agent Manager (`agent/.mise.toml`).

## Setup options

| Flag | Effect |
|------|--------|
| `--setup-only` | Install + build, do not launch IDE (default) |
| `--launch-ide` | Run full setup, then launch Quantum IDE |
| `--verify-only` | Run verification checks without installing |
| `--skip-cli` | Skip Quantum CLI |
| `--skip-agent` | Skip Quantum Agent Manager |
| `--skip-ide` | Skip Quantum IDE |
| `--skip-install` | Skip dependency installation |
| `--skip-build` | Skip compile/build steps |
| `-h`, `--help` | Show usage |

### Examples

```bash
# Full ecosystem setup
./scripts/setup.sh

# Setup without the slow IDE compile (CLI + Agent only)
./scripts/setup.sh --skip-ide

# Re-verify an existing setup
./scripts/verify.sh

# IDE only (from repo root)
./scripts/setup.sh --skip-cli --skip-agent

# Setup and open the editor
./scripts/setup.sh --launch-ide
```

## Verification

```bash
./scripts/verify.sh              # Build artifacts present
./scripts/e2e.sh                 # Full E2E smoke suite (recommended)
./scripts/e2e.sh --quick         # Fast smoke only
./scripts/e2e.sh --full          # Includes full agent server unit tests (~7 min)
./scripts/e2e.sh --only cli
./scripts/verify.sh --skip-ide
```

Checks:

- **CLI** — `node_modules`, `dist/cli.mjs`, `--version` runs
- **Agent** — workspace install, contracts/server/web/desktop build outputs
- **IDE** — delegates to `ide/scripts/verify-dev.sh`

## Subsystem scripts

Each subsystem also has its own setup script:

| Subsystem | Script |
|-----------|--------|
| CLI | `cli/scripts/setup.sh` |
| Agent Manager | `agent/scripts/setup.sh` |
| IDE | `ide/scripts/setup.sh` (macOS/Linux) / `ide/scripts/setup.bat` (Windows) |

The root `scripts/setup.sh` orchestrates these in order and runs verification at the end.

## After setup

```bash
# Terminal agent
./cli/bin/quantum

# Agent Manager (dev stack)
cd agent && bun run dev

# IDE
cd ide && ./scripts/code.sh

# IDE with live rebuilds (two terminals)
cd ide && npm run watch          # terminal 1
cd ide && VSCODE_SKIP_PRELAUNCH=1 ./scripts/code.sh   # terminal 2
```

### Environment configuration

- **CLI**: copy `cli/.env.example` → `cli/.env` and add provider API keys
- **IDE**: configure models in Quantum Settings (`~/.agent/index/globalContext.json`)
- **Agent Manager**: runs locally; see `agent/README.md` for dev port isolation

## Troubleshooting

| Issue | Fix |
|-------|-----|
| IDE Node version mismatch | `cd ide && nvm install && nvm use` (reads `.nvmrc`) |
| IDE npm too new | Use npm bundled with Node 22 via nvm (must be < 11.2) |
| IDE `code.sh` fails on `.ts` extension | Use Node **22.22.1** from `ide/.nvmrc` (`nvm use` in `ide/`) — launch scripts call `node-ts.sh` with `--experimental-strip-types` |
| Agent build fails | Ensure Bun >= 1.3.9; try `cd agent && bun install && bun run build` |
| CLI missing API key | Copy `.env.example`; run `cd cli && bun run doctor:runtime` |
| Re-run from scratch | Remove `node_modules` / `dist` / `out` in the affected subsystem, then `./scripts/setup.sh` |
