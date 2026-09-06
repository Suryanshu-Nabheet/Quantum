# Contributing to Quantum

Thank you for your interest in contributing to the Quantum ecosystem.

## Monorepo Subsystems

Quantum is organized into three distinct subsystems:

- `ide/` — Quantum IDE (AI-native editor based on VS Code)
- `agent/` — Quantum Agent Manager (Autonomous desktop workspace & multi-agent harness)
- `cli/` — Quantum CLI (Terminal-first AI coding agent)
- `docs/` — System architecture and ecosystem specifications

## Development setup

From the monorepo root:

```bash
./scripts/setup.sh          # Install + build CLI, Agent Manager, and IDE
./scripts/verify.sh         # Confirm all subsystems are ready
```

Per-subsystem setup scripts live in `cli/scripts/`, `agent/scripts/`, and `ide/scripts/`. See [scripts/README.md](scripts/README.md).

## Guidelines

1. **Isolation Principle**: Keep subsystem-specific dependencies, configs, and documentation cleanly contained inside each subsystem directory.
2. **Client-Side Privacy**: Never introduce third-party telemetry, remote tracking, or non-consensual network requests.
3. **Testing**: Run tests for the specific package you are modifying prior to submitting pull requests.
4. **Commit Conventions**: Format commit messages according to the Conventional Commits specification (e.g., `feat(agent): ...`, `fix(ide): ...`, `docs: ...`).

## Reporting Issues

Open issues in the repository issue tracker with complete reproduction steps, operating system details, and relevant runtime logs.
