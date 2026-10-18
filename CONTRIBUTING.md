# Contributing to Quantum

Thank you for your interest in contributing to the Quantum ecosystem.

## Monorepo products

| Path | Product |
| --- | --- |
| `ide/` | Quantum IDE (AI-native editor based on VS Code) |
| `agent/` | Quantum Agent Manager — parallel agents, one workspace |
| `docs/` | Architecture and ecosystem documentation |
| `web/` | Public website (in progress) |
| `build/` | Release packaging (upstream VS Code → Quantum binaries) |

## Development setup

From the monorepo root:

```bash
npm ci                      # Root Turbo orchestration (committed lockfile)
./scripts/setup.sh          # Install + build Agent Manager and IDE
./scripts/verify.sh         # Repo config + product verification
npm run eval                # Workbench Agent regression (optional)
```

Orchestration model: [docs/architecture/monorepo-orchestration.md](docs/architecture/monorepo-orchestration.md).

Per-product setup: `agent/scripts/`, `ide/scripts/`. See [scripts/README.md](scripts/README.md).

Full documentation: **[docs/readme.md](docs/readme.md)** (getting started, IDE, Agent Manager, workbench agent, architecture).

## Editor and AI setup

1. Open **[`Quantum.code-workspace`](Quantum.code-workspace)** in VS Code or Cursor (multi-root: root, agent, ide, docs, build, eval).
2. Install extension recommendations when prompted.
3. **Tasks:** `Quantum: Setup`, `Quantum: Verify`, `Agent: dev stack`, `IDE: watch` — [`.vscode/tasks.json`](.vscode/tasks.json).
4. **IDE F5 / debug:** configs live in [`ide/.vscode/`](ide/.vscode/), not at repo root.
5. **AI agents:** [`AGENTS.md`](AGENTS.md), [`.cursor/rules/`](.cursor/rules/), product [`agent/AGENTS.md`](agent/AGENTS.md) and [`ide/AGENTS.md`](ide/AGENTS.md).

### What to commit

**Canonical policy:** [docs/version-control.md](docs/version-control.md) — shared config vs secrets vs build artifacts.

Quick rule: commit **source** and **team editor config**; never commit **`.env`**, **`node_modules/`**, or compile **`out/` / `dist/`**.

Check a path: `git check-ignore -v path/to/file`  
Automated check: `./scripts/verify-repo-config.sh`

| Committed at root | Local only |
| --- | --- |
| `.vscode/settings.json`, `tasks.json`, `launch.json`, `extensions.json`, `README.md` | Other `.vscode/*` |
| `.cursor/rules/`, `.cursor/mcp.json`, `.cursorignore` | Cursor user settings |
| `.idea/` modules, `codeStyles/`, `runConfigurations/`, `*.iml` | `.idea/workspace.xml`, `shelf/` |
| `AGENTS.md`, `Quantum.code-workspace`, `.editorconfig`, `.gitattributes` | — |

[`.cursorignore`](.cursorignore) affects Cursor search only, **not** git.

## Guidelines

1. **Isolation:** Keep product-specific dependencies and docs inside each product directory unless the change is truly monorepo-wide.
2. **Client-side privacy:** No third-party telemetry or non-consensual network requests.
3. **Testing:** Run tests for the package you modify before opening a PR.
4. **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) — `feat(agent): …`, `fix(ide): …`, `docs: …`, `chore: …`.

## Reporting issues

Open issues with reproduction steps, OS details, and relevant logs.
