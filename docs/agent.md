# Agent and browser

Quantum Agent works alongside the editor. You can ask it to explain a codebase, plan a change, edit files, or run tools. Review proposed changes and tool requests in the interface.

## Configure models

Open Agent Settings and add a provider and model. Assign models to the roles you want to use, such as chat or autocomplete. Quantum supports multiple remote providers and local models. Availability and capabilities depend on the provider and model you configure.

## Add context

Use the context menu in the Agent input to attach relevant files, code, images, terminal output, Git context, or browser content. Context options vary with the current workspace and available providers.

Project instruction files include `AGENTS.md`, `AGENT.md`, and `CLAUDE.md`. Rules, prompts, tools, and MCP servers can also be managed in Agent Settings.

## Control tool use

Agent Settings provides access and terminal controls, protected paths, and per-tool policies. Depending on those settings, a tool can run automatically, ask for approval, or be denied. Check the request and its scope before accepting it. File edits can be reviewed and accepted or rejected in Quantum.

## Use the integrated browser

Open a page in Quantum's browser and share it with the Agent. The element picker attaches a selected page element as context. Browser tools can open and navigate pages, inspect content, interact with elements, and capture screenshots when available.

## Local data

Agent configuration and sessions are stored under `~/.agent/` by default. The configuration includes models, rules, prompts, and MCP servers. Session history is stored in `~/.agent/sessions/`. Workbench data uses the Quantum application data directory, which varies by operating system and build.
