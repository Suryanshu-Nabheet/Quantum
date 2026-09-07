# Quantum

### AI Engineering and Autonomous Development Platform
**Author: Suryanshu Nabheet**

---

Quantum is an integrated software development platform architected for modern software engineering workflows. The monorepo houses two developer products: an AI-native IDE and a desktop agent orchestrator.

---

## Products Overview

| Product | Directory | Description | Technology Stack |
| :--- | :--- | :--- | :--- |
| **Quantum IDE** | [`ide/`](ide/) | AI-native editor with embedded workbench agent, inline code generation, and DOM inspection. | TypeScript, Electron, Monaco |
| **Quantum Agent Manager** | [`agent/`](agent/) | Parallel agents, one workspace — Spaces, Activity, and multi-provider orchestration. | Electron, React, Effect, MCP |

---

### Quantum IDE

AI-native code editor featuring a first-party autonomous agent embedded directly into the workbench, inline code generation, DOM inspection, and an integrated browser for live page context attachment.

<p align="center">
  <img src="ide/assets/screenshots/demo.png" alt="Quantum IDE Screenshot" width="100%" />
</p>

- **Directory**: [`ide/`](ide/)
- **Description**: An AI-first development environment derived from VS Code with native workbench agent integration (`src/vs/workbench/contrib/agent`), integrated browser integration, and context-aware code synthesis.
- **Technology Stack**: TypeScript, Electron, Monaco Editor, Chromium

---

### Quantum Agent Manager

MCP-native agent manager for orchestrating parallel AI coding sessions — multi-model workflows, Spaces, Activity, and isolated git worktrees.

<p align="center">
  <img src="agent/assets/screenshots/demo.png" alt="Quantum Agent Manager Screenshot" width="100%" />
</p>

- **Directory**: [`agent/`](agent/)
- **Description**: Desktop orchestration suite for managing concurrent agent tasks, multi-provider LLM routing, split chats, live terminals, browser previews, and cross-model handoffs in a single unified interface.
- **Technology Stack**: Electron, React, Effect-TS, Model Context Protocol (MCP)

---

## Monorepo Architecture

```
quantum/
├── agent/                 # Quantum Agent Manager
│   ├── apps/desktop/      # Native desktop window manager and runtime
│   ├── apps/server/       # Effect-based orchestration server
│   └── apps/web/          # Management interface and timeline renderer
│
├── build/                 # Quantum release build (VS Code upstream → branded binary)
│
├── docs/                  # Documentation (Docusaurus)
│
├── extensions/            # Quantum built-in extensions (for release build)
│
├── ide/                   # Quantum IDE codebase
│   ├── src/               # Editor core and workbench agent implementation
│   ├── extensions/        # Built-in developer extensions
│   └── build/             # Microsoft gulp toolchain (daily dev compile)
│
├── scripts/               # Monorepo setup and verification (./scripts/setup.sh)
│
├── LICENCE                # MIT License
├── CONTRIBUTING.md        # Monorepo development guidelines
└── SECURITY.md            # Security and vulnerability disclosure policies
```

---

## Architectural Principles

- **Client-Side Data Isolation**: All code, configurations, session states, and credentials remain strictly on the host machine. No telemetry or non-consensual external network requests are executed.
- **Model Context Protocol (MCP) Compliance**: Standardized tool calling, resource resolution, and custom prompt execution across all interfaces.
- **Multi-Model Support**: Native integrations for Anthropic Claude, OpenAI GPT, Google Gemini, DeepSeek, xAI Grok, AWS Bedrock, Azure OpenAI, and local inference via Ollama.
- **Modular Packaging**: Subsystems maintain explicit boundaries, distinct build toolchains, and independent release cycles.

---

## Getting Started

One command sets up both products (Agent Manager + IDE):

```bash
./scripts/setup.sh
```

| Platform | Command |
|----------|---------|
| macOS / Linux | `./scripts/setup.sh` |
| Windows | `scripts\setup.bat` |

**Prerequisites:** [Bun](https://bun.sh) (>= 1.3.9), Node.js (>= 22; IDE pins 22.22.1 via `ide/.nvmrc`), Python 3.10–3.13 for IDE native modules.

```bash
# Verify after setup
./scripts/verify.sh
./scripts/e2e.sh

# Launch individual products
cd agent && bun run dev        # Agent Manager
cd ide && ./scripts/code.sh    # IDE
```

See [scripts/README.md](scripts/README.md) for flags (`--skip-ide`, `--launch-ide`, per-subsystem setup) and troubleshooting.

---

## Documentation Links

- [Quantum IDE Specification](ide/README.md)
- [Quantum Agent Manager Specification](agent/README.md)
- [Ecosystem Architecture Documentation](docs/readme.md)

---

## License

This software is distributed under the MIT License. See [LICENCE](LICENCE) for complete legal terms.
