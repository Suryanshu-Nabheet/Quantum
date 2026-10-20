# Quantum IDE

**Quantum IDE** is an MIT-licensed, AI-native code editor — a fork of [Visual Studio Code](https://github.com/microsoft/vscode) with a **first-party workbench agent** and an embedded browser that can attach live page context to chat.

**Path:** [`ide/`](../../ide/)  
**Human README:** [`ide/README.md`](../../ide/README.md)

## What it is

| Layer | Description |
| --- | --- |
| **Workbench** | Full VS Code heritage: editing, terminal, debug, Git, search, extensions |
| **Workbench Agent** | Built-in AI sidebar, tools, MCP, apply/diff, tab autocomplete — [`contrib/agent`](../../ide/src/vs/workbench/contrib/agent/) |
| **Browser** | `browserView` + element picker; agent browser tools |
| **Extensions** | Open VSX; Microsoft telemetry removed at source |

User data directory: **`~/.quantum`** (see `ide/product.json` for product-specific names in dev).

## AI Architecture: Quantum Agent vs Upstream Microsoft Copilot

> [!IMPORTANT]
> **Quantum uses its own first-party Agent (`ide/src/vs/workbench/contrib/agent`) for all agentic AI features — NOT Microsoft's Copilot codebase.**
>
> Just as **Cursor** forks the VS Code editor shell but replaces VS Code's native Copilot AI code with their own **Composer**, **Quantum** uses the VS Code editor workbench as a host shell while powering **all** chat, inline edit, tab autocomplete, plan mode, to-do lists, MCP, and autonomous tool workflows exclusively through **`ide/src/vs/workbench/contrib/agent`**.
>
> **Do not confuse with upstream Microsoft Copilot directories:**
> - `ide/src/vs/workbench/contrib/chat/` — Upstream Microsoft VS Code Copilot chat infrastructure (**NOT used by Quantum Agent**).
> - `ide/src/vs/workbench/contrib/inlineChat/` — Upstream Microsoft Copilot inline chat (**NOT used by Quantum Agent**).
> - `ide/src/vs/sessions/` — Upstream Microsoft Copilot session window experiment (**NOT used by Quantum Agent**).
> - `ide/src/vs/platform/chat/` — Upstream Microsoft Copilot platform types.
>
> If you are working on AI features, chat UI, model integrations, prompt generation, tool execution, diff application, or agent workflows, **all work belongs in `ide/src/vs/workbench/contrib/agent/`**.

## High-level architecture

```
ide/
├── src/vs/workbench/contrib/agent/   # Workbench Agent (core, gui, extension host)
├── src/vs/workbench/contrib/browserView/
├── src/vs/platform/browserView/      # Electron / CDP / Playwright stack
├── extensions/                       # Built-in extensions (dev compile)
├── build/gulpfile.agent.ts           # compile-agent / watch-agent
└── out/agent/                        # Generated built-in agent extension (not in git)
```

```mermaid
flowchart LR
  subgraph IDE["Quantum IDE"]
    WB[Workbench UI]
    AH[Extension host]
    AG[contrib/agent]
    GUI[Agent GUI webview]
    WB --> AH
    AH --> AG
    AG --> GUI
  end
  Disk["~/.agent / ~/.quantum"]
  LLM[User-configured LLM APIs]
  AG --> Disk
  AG --> LLM
```

## Capabilities (product)

- **Agent sidebar** — chat, `@` context, `/` prompts, rules, skills (`.agents/skills/`)
- **Multi-provider models** — Anthropic, OpenAI, Gemini, Azure, Bedrock, Ollama, OpenRouter, Groq, xAI, DeepSeek, and more
- **Model roles** — chat, autocomplete, apply/edit, embeddings
- **Tools** — files, search, terminal, diffs; per-tool allow / ask / deny
- **MCP** — user-configured servers from Agent Settings
- **Plan mode & todos** — structured multi-step work in chat
- **Layouts** — Agent / Editor / Zen / Browser

## Related docs

- [IDE development](quantum-ide-development.md)
- [Workbench Agent](workbench-agent.md)
- [Architecture overview](../architecture/overview.md)

## Downloads

Installers: [GitHub Releases](https://github.com/Suryanshu-Nabheet/Quantum/releases/latest) (see [`ide/README.md`](../../ide/README.md) for platform assets).
