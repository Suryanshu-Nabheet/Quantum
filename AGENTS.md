# Quantum monorepo — agent instructions

This repository contains two products. Use the product-specific guide for implementation work:

| Product | Path | Agent guide |
| --- | --- | --- |
| Quantum Agent Manager | `agent/` | [agent/AGENTS.md](agent/AGENTS.md) |
| Quantum IDE | `ide/` | [ide/AGENTS.md](ide/AGENTS.md) |

## Setup and verification

From the repo root:

```bash
./scripts/setup.sh    # Install + build Agent Manager and IDE
./scripts/verify.sh   # Confirm both products are ready
```

See [scripts/README.md](scripts/README.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

## Scope boundaries

- Keep dependencies, tooling, and docs inside each product directory unless the change is truly monorepo-wide (root `scripts/`, shared policy, workspace config).
- Do not add telemetry or non-consensual network calls (see [readme.md](readme.md)).
- IDE debugging and F5 launch configs live in `ide/.vscode/` — open the **IDE** folder or use `Quantum.code-workspace` for day-to-day editor work on `ide/`.

## Version control

Follow [docs/version-control.md](docs/version-control.md): commit source and shared team config; never commit secrets, `node_modules/`, or build outputs.

Before claiming workspace setup is complete, run:

```bash
./scripts/verify-repo-config.sh
```

## Commits

Use Conventional Commits with product scope: `feat(agent): …`, `fix(ide): …`, `docs: …`.
