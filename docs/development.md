# Development

## Prerequisites

- Node.js 22.22.1, specified in [`.nvmrc`](../.nvmrc), and its bundled npm.
- Python 3.10–3.13. Python 3.11 is used by CI.
- Native build tools for your platform, such as Xcode Command Line Tools, build-essential, or Visual Studio Build Tools.
- Rust when building the CLI tunnel binary.

## Setup and launch

```bash
nvm use
./scripts/setup.sh
```

On Windows, run `scripts\setup.bat`. To prepare without launching, use `./scripts/setup.sh --setup-only`. Once the build exists, `./scripts/setup.sh --launch-only` launches it without rebuilding.

For active development, run `npm run watch` in one terminal and `VSCODE_SKIP_PRELAUNCH=1 ./scripts/code.sh` in another. Reload the window when needed. The [script reference](../scripts/README.md) describes the watch pipelines and Windows commands.

## Checks

Choose checks for the files changed. For workbench TypeScript, run:

```bash
npm run compile-check-ts-native
npm run valid-layers-check
```

For Agent changes, run the verification suite from `src/vs/workbench/contrib/agent/`:

```bash
npm run verify
```

Follow [AGENTS.md](../AGENTS.md) for the required Agent checks and desktop smoke test. The [Agent maintainer guide](../src/vs/workbench/contrib/agent/README.md) describes its build and runtime.

## Troubleshooting

- If npm rejects the current version, select Node 22.22.1 with `nvm use`.
- If a native dependency fails to build, check the Python version and platform build tools.
- If a build runs out of memory, close other applications and retry.
- If dependencies or generated output are missing, run `./scripts/setup.sh --setup-only`.

## Packaging and releases

The [release workflow](../.github/workflows/release.yml) builds release assets from a version tag. It checks the tag against Quantum's configured release version. The separate [release builder](../build/quantum-release/README.md) documents its own preparation and packaging process.
