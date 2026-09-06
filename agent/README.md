# Quantum Agent Manager

Quantum Agent Manager is an MCP-native, local-first desktop workspace and agent harness for orchestrating AI coding agents and parallel developer automations.

<p align="center">
  <img src="./assets/screenshots/demo.png" alt="Quantum Agent Manager Demo" width="100%" />
</p>

---

## Overview

Quantum Agent Manager brings multi-model chats, terminals, browser previews, unified diffs, branches, provider sessions, and cross-model handoffs into a unified, high-performance desktop workspace.

## Key Features

- **Multi-Provider Harness**: Orchestrate Claude Code, Codex, Antigravity, OpenCode, Cursor, Grok, Kilo Code, and Pi.
- **Parallel Worktrees**: Run concurrent agent tasks across projects and threads with isolated Git worktrees.
- **Unified Workspace**: Split chats, live terminals, native browser previews, and streaming tool outputs in a single window.
- **Agent Handoffs**: Hand off active context and task state between different models seamlessly.
- **Local-First & Private**: Chats, projects, state, and credentials stay on your local machine with zero third-party telemetry.
- **MCP Native**: Deep integration with Model Context Protocol servers and resources.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (v1.3+)
- [Node.js](https://nodejs.org) (v24+)

### Installation & Development

```sh
# From monorepo root (recommended — sets up CLI + Agent + IDE together)
../scripts/setup.sh --skip-cli --skip-ide

# Or from this directory only
./scripts/setup.sh

# Install dependencies
bun install

# Start full development suite
bun run dev
```

### Desktop Application

```sh
# Start desktop Electron app with live reload
bun run dev:desktop
```

### Building for Production

```sh
# Build desktop packages
bun run build
```

---

## License

MIT License. Copyright (c) 2026 Suryanshu Nabheet. See [LICENSE](./LICENSE) for details.
