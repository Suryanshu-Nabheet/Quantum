# Monorepo orchestration

Quantum is a **federated monorepo**: two production codebases (`ide/`, `agent/`) with **separate install graphs**, unified by **root scripts** (bash), **Turbo** (task graph), and **mise** (tool pins).

## Why root orchestration is not TypeScript

| Layer | Language | Reason |
| --- | --- | --- |
| `agent/`, `ide/` | TypeScript | Product code — built, typed, tested in each tree |
| Root `scripts/` | bash | Same pattern as `setup.sh` / `verify.sh`; no extra compile step or second runtime |

Adding Node `.mjs` at the root would duplicate bash, need its own tests, and ship no user-facing feature. Root `package.json` scripts call `scripts/*.sh` directly; there is no wrapper package.

## Toolchain matrix

| Tool | IDE (`ide/`) | Agent (`agent/`) | Root |
| --- | --- | --- | --- |
| Package manager | **npm** (&lt; 11.2) | **Bun** (≥ 1.3.9) | **npm** (Turbo only) |
| Node.js | **22.22.1** (`ide/.nvmrc`) | **≥ 24** (`mise.toml`) | ≥ 22 for `npm ci` |
| Task runner | gulp + npm | Turbo in `agent/` | Turbo (`eval`, delegates) |

## Layout

```
package.json, package-lock.json, turbo.json, mise.toml
scripts/                    # setup, verify, monorepo-doctor.sh
eval/                       # @quantum/eval — only root workspace
agent/                      # Bun + TypeScript
ide/                        # npm + TypeScript (VS Code fork)
```

## Commands

```bash
npm ci
./scripts/setup.sh
./scripts/verify.sh
npm run doctor              # scripts/monorepo-doctor.sh
npm run doctor:strict       # fail if product node_modules missing
npm run eval
```

Turbo runs the `eval` workspace: `npx turbo run eval`

## What we do not do

- Single package manager or shared `node_modules` for `ide` + `agent`
- Cross-imports between product trees
- Extra manifests or JS layers that mirror `verify-repo-config.sh`

Commit policy paths: `scripts/verify-repo-config.sh` (source of truth).

## Related

- [Monorepo map](../reference/monorepo-map.md)
- [Getting started](../getting-started.md)
