# Quantum Agent

Quantum Agent works alongside the editor. It can answer questions, inspect a project, plan work, propose edits, and use tools. Its behavior depends on the selected model, its capabilities, the workspace, and your permission settings.

## Start a conversation

Open the Agent sidebar, select a configured chat model, choose a mode, and enter a request. Use **New Chat** to start a separate conversation or **History** to reopen an earlier one. The model selector applies to the current chat; model roles and providers are configured in Settings.

- **Chat** is for questions and explanations. For a change, it can suggest code for you to apply or ask you to switch modes.
- **Plan** helps break down work before implementation. Review the plan and clarify constraints before proceeding.
- **Agent** can inspect files, use available tools, and propose or make changes subject to your tool policies.

The Agent can maintain a to-do list during a task. Its progress and tool activity appear in the conversation. The context indicator shows the approximate amount used against the model's configured context window; it is not a billing statement.

## Set up a model

1. Open **Settings**, then **Models** and choose **Add provider**.
2. Select a provider and enter the credentials it requires. For a custom OpenAI-compatible endpoint, choose **Custom provider**, enter its name, API base URL, model ID, and API key if required. You can supply a context window in tokens when it is not known automatically.
3. Connect the provider and choose models for the roles you need. Chat, edit, apply, and autocomplete can use different models where supported.
4. Return to the Agent and select the chat model. Model availability, context length, image support, and tool calling vary by provider and model. Enter the provider's exact model ID for custom endpoints.

Remote providers receive the prompts and context needed for a request and may charge for usage. Local or self-hosted models require a running compatible server. If a model does not appear, check the endpoint, credentials, model ID, and role configuration; see [Troubleshooting](troubleshooting.md).

## Give the Agent context

Use `@` in the input to choose available context such as files, code, terminal output, Git changes, and browser content. Attach only what is needed for the task. Available context types depend on the workspace, configuration, and selected model; images and other media also depend on model support.

For example, open the project folder, attach a relevant file, and ask the Agent to explain how it handles a particular request. For a change, describe the desired behavior and any constraints, then inspect the resulting diff.

## Tools and approvals

Agent tools include reading and searching workspace files, listing directories, editing files, running terminal commands, maintaining plans and to-dos, using the browser, and web search. Available tools depend on mode, model support, configuration, and permissions. Tool calls and their results appear in the conversation.

Settings provides per-tool policies and Agent access controls. A tool may run automatically, require approval, or be disabled. **Full access**, **Sandboxed**, and **Strict** affect file and terminal access; terminal execution can be set to **Run Everything**, **Use Allowlist**, or **Ask Every Time**. Protected paths and hard blocks still matter. Review the command, file paths, and requested scope before approving. Accept or reject file changes using the diff controls.

Web search uses Exa's hosted anonymous search endpoint and returns source links and excerpts. Search queries are sent to that service. Results are external material: open sources and check important claims. Anonymous access can be rate-limited or temporarily unavailable; the Agent should report an error rather than invent results.

## Inline editing and autocomplete

Select code and invoke inline editing to request a focused change, then review the proposed diff. Tab autocomplete offers suggestions while you type when an autocomplete model is configured. Suggestions depend on the model and current context; review them before accepting. Settings includes autocomplete controls and model selection.

## Rules, prompts, and MCP

Use Settings to manage rules and reusable prompts. Workspace instruction files such as `AGENTS.md`, `AGENT.md`, and `CLAUDE.md` can provide project-specific guidance. Keep instructions concrete and review which rules are applied to a conversation.

Model Context Protocol (MCP) servers provide additional tools and context. Configure servers in **Settings → MCP**, then check their connection and the policies for their tools. A server runs with the access granted by its configuration; use servers you trust and review tool requests.

## Local data

Agent configuration and sessions are stored under `~/.agent/` by default; session history is in `~/.agent/sessions/`. Workbench data uses the Quantum application data directory, which varies by operating system and build. Treat configuration and backups as potentially sensitive because they can contain provider and server settings.

For browser sharing, navigation, and interaction, see [Integrated browser](browser.md).
