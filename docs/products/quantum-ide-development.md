# Quantum IDE — development

Day-to-day engineering on the IDE tree (`ide/`).

## Prerequisites

| Tool | Version |
| --- | --- |
| Node.js | **22.22.1** — `cd ide && nvm use` |
| npm | **&lt; 11.2** |
| Python | 3.10–3.13 (avoid 3.14 with node-gyp) |
| Rust | Only if building `ide/cli/` tunnel binary |

## Setup

From monorepo root:

```bash
./scripts/setup.sh
# or IDE only:
./scripts/setup.sh --skip-agent
```

From `ide/`:

```bash
./scripts/setup.sh --setup-only
```

## Compile and run

```bash
cd ide
npm run compile
./scripts/code.sh
```

### Watch mode (recommended)

```bash
# Terminal 1
npm run watch

# Terminal 2
VSCODE_SKIP_PRELAUNCH=1 ./scripts/code.sh
```

`npm run watch` includes client, extensions, and **agent** (extension bundle + GUI + packages). Use `./scripts/verify-watch.sh` if outputs look stale.

## TypeScript and validation

Follow [`ide/.github/copilot-instructions.md`](../../ide/.github/copilot-instructions.md):

- Do **not** use full `npm run compile` only to type-check small `src/` edits when watch / `compile-check-ts-native` is available.
- Layer check: `npm run valid-layers-check`
- Unit tests: `scripts/test.sh` (from `ide/`)

**Agent harness changes** require the full matrix in [`ide/AGENTS.md`](../../ide/AGENTS.md) (tsc, vitest, gui tests, desktop smoke).

## Debugging

- Launch configs: [`ide/.vscode/launch.json`](../../ide/.vscode/launch.json)
- Workbench Agent: compile agent first (`npm run compile-agent` or `npm run watch`)

## Packaging

```bash
cd ide
npm run gulp vscode-darwin-arm64-min
```

Release pipeline from pinned upstream: [`build/dev/build.sh`](../../build/dev/build.sh) — see [`build/docs/howto-build.md`](../../build/docs/howto-build.md).

## Key paths

| Path | Purpose |
| --- | --- |
| `src/vs/workbench/contrib/agent/` | Workbench Agent source |
| `src/vs/workbench/contrib/browserView/` | In-IDE browser |
| `build/gulpfile.agent.ts` | Agent build integration |
| `out/agent/` | Built-in `quantum.agent` extension output |
| `product.json` | Branding, update endpoints, data folder names |

## Troubleshooting

See the table in [`ide/README.md`](../../ide/README.md#troubleshooting) and [`scripts/README.md`](../../scripts/README.md).

## See also

- [Workbench Agent](workbench-agent.md)
- [For contributors](../for-contributors.md)
