# Quantum Monorepo Scripts

Production-grade setup and verification for both Quantum products.

## Quick start

| Platform | Command |
|----------|---------|
| macOS / Linux | `./scripts/setup.sh` |
| Windows | `scripts\setup.bat` |

Full setup installs dependencies and builds **Agent Manager → IDE**. The IDE compile step is the longest; expect several minutes on first run.

## Prerequisites

| Tool | Agent Manager | IDE |
|------|---------------|-----|
| [Bun](https://bun.sh) | >= 1.3.9 | — |
| Node.js | >= 24 (see `agent/package.json`) | **22.22.1** (`.nvmrc`) |
| npm | — | required, **< 11.2** |
| Python | — | 3.10–3.13 (native modules) |

Recommended: install [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) for IDE Node version management, and [mise](https://mise.jdx.dev) for Agent Manager (`agent/.mise.toml`).

## Setup options

| Flag | Effect |
|------|--------|
| `--launch-ide` | Run full setup, then launch Quantum IDE |
| `--launch-agent` | Run full setup, then launch Agent Manager dev stack |
| `--skip-agent` | Skip Quantum Agent Manager |
| `--skip-ide` | Skip Quantum IDE |
| `-h`, `--help` | Show usage |

### Examples

```bash
# Full ecosystem setup
./scripts/setup.sh

# Setup without the slow IDE compile (Agent only)
./scripts/setup.sh --skip-ide

# Re-verify an existing setup
./scripts/verify.sh

# IDE only (from repo root)
./scripts/setup.sh --skip-agent

# Setup and open the editor
./scripts/setup.sh --launch-ide
```

## Verification

```bash
./scripts/verify.sh              # Build artifacts present
./scripts/e2e.sh                 # Full E2E smoke suite (recommended)
./scripts/e2e.sh --only agent
./scripts/verify.sh --skip-ide
```

Checks:

- **Agent** — workspace install, contracts/server/web/desktop build outputs
- **IDE** — delegates to `ide/scripts/verify-dev.sh`

## Subsystem scripts

Each product also has its own setup script:

| Product | Script |
|---------|--------|
| Agent Manager | `agent/scripts/setup.sh` |
| IDE (dev) | `ide/scripts/setup.sh` (macOS/Linux) / `ide/scripts/setup.bat` (Windows) |
| IDE (release packaging) | `build/dev/build.sh` — upstream VS Code → Quantum binaries |

The root `scripts/setup.sh` orchestrates these and runs verification at the end.

### Release builds (IDE)

Daily development uses `ide/` (`npm run compile`, `./scripts/code.sh`). To produce packaged Quantum binaries from pinned upstream VS Code:

```bash
cd build && ./dev/build.sh      # compile
cd build && ./dev/build.sh -p   # compile + package
```

See [`build/docs/howto-build.md`](../build/docs/howto-build.md).

## After setup

```bash
# Agent Manager (dev stack)
cd agent && bun run dev

# IDE
cd ide && ./scripts/code.sh

# IDE with live rebuilds (two terminals)
cd ide && npm run watch          # terminal 1
cd ide && VSCODE_SKIP_PRELAUNCH=1 ./scripts/code.sh   # terminal 2
```

### Environment configuration

- **IDE**: configure models in Quantum Settings (`~/.agent/index/globalContext.json`)
- **Agent Manager**: runs locally; see `agent/README.md` for dev port isolation

## Troubleshooting

| Issue | Fix |
|-------|-----|
| IDE Node version mismatch | `cd ide && nvm install && nvm use` (reads `.nvmrc`) |
| IDE npm too new | Use npm bundled with Node 22 via nvm (must be < 11.2) |
| IDE `code.sh` fails on `.ts` extension | Use Node **22.22.1** from `ide/.nvmrc` (`nvm use` in `ide/`) — launch scripts call `node-ts.sh` with `--experimental-strip-types` |
| Agent build fails | Ensure Bun >= 1.3.9; try `cd agent && bun install && bun run build` |
| Re-run from scratch | Remove `node_modules` / `dist` / `out` in the affected subsystem, then `./scripts/setup.sh` |
