# Quantum development MCP server

This directory contains a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that exposes Quantum’s automation and testing APIs to AI assistants and other tools.

## What it provides

- Start and stop Quantum / VS Code test instances
- Interact with editors, terminals, and UI elements
- Run commands and keybindings
- Navigate explorer, search, debug, and other views
- Manage extensions, settings, and keybindings
- Work with notebooks and chat features

## Quick start (stdio)

At the repo root, run full dev setup (recommended):

```bash
./scripts/setup.sh
```

Or manually: `npm install`, `npm run compile`, then `./scripts/code.sh`. Use the MCP tooling from this package per your assistant’s configuration.

## Requirements

- Quantum built from source (`out/` present)
- Dev instance run at least once so user data exists under `quantum-dev` / `~/.quantum-dev`

## Contributing

Changes here are part of Quantum’s test infrastructure. Keep tool names and docs aligned with [product.json](../../product.json) branding.
