# Quantum Agent native architecture

Quantum Agent is a first-party workbench feature. It must not be loaded,
activated, or exposed through extension management.

## Ownership

- `workbench/browser` owns the Agent view, actions, commands, editor
  integrations, inline completions, and user-facing lifecycle.
- `workbench/common` owns the public runtime contracts used by workbench and
  the Agent execution host.
- `core` owns provider calls, conversation orchestration, tools, MCP, context,
  and session behavior. It must not depend on the VS Code extension API.
- `gui` remains the Agent conversation UI. Its host bridge talks to the native
  Agent service contract, not `vscode` extension commands or an extension-host
  messenger.
- Native Node work runs in an IDE-owned process and crosses an explicit,
  typed IPC boundary. Workbench renderer code must not import Node-only core
  modules.

## Runtime shape

- The IDE registers the Agent view, commands, settings, and inline completion
  provider at workbench startup. No Agent extension manifest or activation is
  part of the runtime.
- The existing GUI remains a bundled webview. Its host bridge is backed by
  `IAgentNativeService` and workbench services.
- Agent Core runs in a per-window Node worker. The shared process owns worker
  lifecycle and transports typed IPC; renderer code never imports Node Core.
- Files, editors, terminals, diagnostics, SCM history, browser tools, and
  secrets are mediated through native IDE services.
- Provider orchestration, tools, MCP, prompts, and sessions remain in Agent
  Core; the extension API adapter tree has been removed.

## Performance follow-up

The old extension entrypoint, extension manifest, duplicate runtime bundle,
and extension-only adapters are no longer built or loaded. Startup and packaged
size have not yet been measured against a pre-migration baseline; collect both
before making quantitative performance claims.
