# Quantum Agent Manager

**Quantum Agent Manager — parallel agents, one workspace.**

MCP-native desktop workspace for orchestrating parallel AI coding agents, multi-model workflows, Spaces, Activity, worktrees, terminals, browser previews, and unified diffs.

<p align="center">
  <img src="./assets/screenshots/demo.png" alt="Quantum Agent Manager Demo" width="100%" />
</p>

---

## Overview

Quantum Agent Manager brings multi-model chats, Spaces, Activity tracking, terminals, native browser previews, git/PR workflows, and cross-provider handoffs into one high-performance desktop workspace.

## Capabilities

- **Spaces & Activity** — organize repos spatially and watch agent work from a live task feed
- **Multi-provider orchestration** — run and hand off between Codex, Claude, Cursor, Grok, Pi, and more
- **Parallel worktrees** — isolated git worktrees per agent thread
- **Unified workspace** — chat, terminal, diff, browser, and PR panes in one window
- **Private by design** — state, credentials, and chats stay in your Quantum data directory
- **MCP native** — deep Model Context Protocol integration for tools and resources

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
