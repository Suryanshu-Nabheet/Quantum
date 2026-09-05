# Contributing to Quantum

Thank you for your interest in improving Quantum.

## How to contribute

1. **Fork** [github.com/Suryanshu-Nabheet/Quantum](https://github.com/Suryanshu-Nabheet/Quantum) and create a branch from `main`.
2. **Set up** the dev environment:
   - **Recommended:** `./scripts/setup.sh` (macOS/Linux) or `scripts\setup.bat` (Windows) — see [README.md](README.md#getting-started) and [scripts/README.md](scripts/README.md).
   - Dev builds store settings under `quantum-dev` (see README).
3. **Make focused changes** — keep PRs scoped to one concern when possible.
4. **Verify** your change builds: `npm run compile` (or `npm run watch` during development). Type-check main sources with `npm run compile-check-ts-native` when you only change files under `src/`.
5. **Open a pull request** with a clear description and test steps.

## Reporting issues

- Search [existing issues](https://github.com/Suryanshu-Nabheet/Quantum/issues) before filing a new one.
- Include OS, Node version (`node -v`), npm version (`npm -v`), and steps to reproduce.
- For extension-specific bugs, note whether the issue reproduces with all extensions disabled (`--disable-extensions`).

## Security

Do not open public issues for security vulnerabilities. See [SECURITY.md](SECURITY.md).

## Code of conduct

Be respectful and constructive. We aim to keep this project welcoming to contributors of all experience levels.

## Upstream

Quantum is based on Visual Studio Code. Large architectural changes should consider maintainability against future upstream concepts. When in doubt, discuss in an issue before a large refactor.
