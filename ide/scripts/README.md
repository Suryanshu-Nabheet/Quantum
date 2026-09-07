# Development scripts

Scripts for building and running Quantum from source. Prerequisites are in [README.md](../README.md#getting-started).

## Quick start

| Platform | Command |
|----------|---------|
| macOS / Linux | `./scripts/setup.sh` |
| Windows | `scripts\setup.bat` |

Full setup installs dependencies, compiles TypeScript, downloads Electron (on first launch), and opens the repo as the workspace.

## Setup options

| Flag | Effect |
|------|--------|
| `--setup-only` | Install + compile, do not launch |
| `--launch-only` | Launch only (skip install and compile) |
| `--skip-install` | Skip `npm install` |
| `--skip-compile` | Skip `npm run compile` (requires `out/main.js`) |
| `--` | Forward following args to `code.sh` / `code.bat` |
| `-h`, `--help` | Show usage (`setup.sh` only) |

Examples:

```bash
./scripts/setup.sh --setup-only
./scripts/setup.sh --launch-only
./scripts/setup.sh -- --disable-extensions
```

## Launch without full setup

After the first successful setup:

```bash
./scripts/code.sh                              # macOS / Linux
VSCODE_SKIP_PRELAUNCH=1 ./scripts/code.sh      # skip Electron/compile checks
scripts\code.bat                               # Windows
```

## Other scripts

| Script | Purpose |
|--------|---------|
| `setup.sh` / `setup.bat` | Full dev setup (install, compile, launch) |
| `node-ts.sh` | Run TypeScript build scripts (`--experimental-strip-types` + `.nvmrc` check) |
| `verify-dev.sh` | Check Node, deps, build, bins, typecheck |
| `code.sh` / `code.bat` | Run dev build of Quantum |
| `code-cli.sh` / `code-cli.bat` | CLI entry |
| `code-server.sh` | Server build |
| `code-web.sh` | Web build |
| `test.sh` / `test.bat` | Unit tests |

Active development (real-time rebuilds):

```bash
# Terminal 1 — keep this running
npm run watch

# Terminal 2 — launch (skip one-shot compile; watch owns rebuilds)
VSCODE_SKIP_PRELAUNCH=1 ./scripts/code.sh
# or: ./scripts/setup.sh --launch-only
```

`npm run watch` runs four pipelines in parallel:

| Pipeline | What it rebuilds on save |
|----------|--------------------------|
| `watch-client-transpile` | Workbench / Electron client (`src/` → `out/`) |
| `watch-client` | Typecheck + API proposal / extension-point / codicon updates |
| `watch-extensions` | Built-in extensions under `extensions/` |
| `watch-agent` | Agent extension host, GUI webview, and agent packages |

After a watched rebuild, use **Developer: Reload Window** (or relaunch) to pick up Electron / extension-host changes. Agent GUI webview updates usually apply on the next panel refresh.

Do **not** run a second `npm run watch` (or a lone `watch-extensions`) in parallel — two watchers cleaning the same `out/` dirs will race and break activation.
