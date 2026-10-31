# Monorepo orchestration

Quantum is a **federated monorepo**: two production codebases (`ide/`, `agent/`) with **separate install graphs**, coordinated by **root scripts** (bash) and **mise** (tool pins). Turbo remains local to `agent/`.

## Why root orchestration is not TypeScript

| Layer | Language | Reason |
| --- | --- | --- |
| `agent/`, `ide/` | TypeScript | Product code — built, typed, tested in each tree |
| Root `scripts/` | bash | Same pattern as `setup.sh` / `verify.sh`; no extra compile step or second runtime |

Adding Node `.mjs` at the root would duplicate bash, need its own tests, and ship no user-facing feature. Root `package.json` scripts call `scripts/*.sh` directly; there is no wrapper package.

## Toolchain matrix

| Tool | IDE (`ide/`) | Agent (`agent/`) | Root |
| --- | --- | --- | --- |
| Package manager | **npm** (&lt; 11.2) | **Bun** (≥ 1.3.9) | None |
| Node.js | **22.22.1** (`ide/.nvmrc`) | **≥ 24** (`mise.toml`) | — |
| Task runner | gulp + npm | Turbo in `agent/` | Bash scripts |

## Layout

```
package.json, mise.toml
scripts/                    # setup, verify, monorepo-doctor.sh
agent/                      # Bun + TypeScript
ide/                        # npm + TypeScript (VS Code fork)
```

## Commands

```bash
./scripts/setup.sh
./scripts/verify.sh
npm run doctor              # scripts/monorepo-doctor.sh
npm run doctor:strict       # fail if product node_modules missing
```

## What we do not do

- Single package manager or shared `node_modules` for `ide` + `agent`
- Cross-imports between product trees
- Extra manifests or JS layers that mirror `verify-repo-config.sh`

## GitHub Actions in the monorepo

GitHub discovers workflows only from the repository-root `.github/workflows/` directory. The product trees retain their own `.github/` configuration, but workflow files under `agent/.github/workflows/` and `ide/.github/workflows/` do not run directly in this monorepo checkout.

The active root workflows provide the monorepo entrypoints:

- `monorepo-ci.yml` checks shared repository configuration and layout.
- `agent-manager-ci.yml` runs the Agent Manager Bun format, lint, typecheck, test, and release-integrity checks.
- `quantum-ide-ci.yml` runs the IDE compile and Workbench Agent compile/layer checks using the IDE's Node and npm toolchain.
- `workbench-agent.yml` installs the Agent's independently locked npm packages and runs its full verification suite.

Changes to product-local CI definitions still trigger their corresponding root pipeline through the product path filters. Keep release and deployment workflows explicit at the repository root before enabling them; they require their own permission and secret review.

Commit policy paths: `scripts/verify-repo-config.sh` (source of truth).

## Related

- [Monorepo map](../reference/monorepo-map.md)
- [Getting started](../getting-started.md)
