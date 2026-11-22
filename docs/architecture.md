# Architecture

Quantum combines an AI coding agent, editor, and development environment in the workbench. Its editor and platform are built on the Visual Studio Code codebase.

## Repository map

| Path | Responsibility |
| --- | --- |
| [`src/vs/base/`](../src/vs/base/) | Shared platform utilities and browser primitives |
| [`src/vs/platform/`](../src/vs/platform/) | Platform services, including the browser view |
| [`src/vs/editor/`](../src/vs/editor/) | Editor implementation |
| [`src/vs/workbench/`](../src/vs/workbench/) | Workbench UI, contributions, and services |
| [`src/vs/workbench/contrib/agent/`](../src/vs/workbench/contrib/agent/) | Quantum Agent runtime, interface, tools, and workbench integration |
| [`src/vs/workbench/contrib/browserView/`](../src/vs/workbench/contrib/browserView/) | Integrated browser workbench |
| [`extensions/`](../extensions/) | Bundled editor extensions and language features |
| [`build/`](../build/) and [`scripts/`](../scripts/) | Build, setup, launch, and packaging tools |

## Agent runtime

The workbench owns the Agent view and connects its webview interface to the Agent runtime worker. The Agent core handles model requests, configuration, context, and tools. Generated runtime and webview assets live under `out/agent/`.

Quantum disables the upstream Copilot experience. Some shared workbench services remain available to the browser integration. Agent development belongs under `src/vs/workbench/contrib/agent/`; see its [maintainer guide](../src/vs/workbench/contrib/agent/README.md) and the repository's [agent instructions](../AGENTS.md).

## Browser integration

The workbench browser can share page context with Quantum Agent. Quantum's browser bridge connects Agent tool requests to browser services. Page sharing and tool permissions control the available interactions.

### Request path

The Agent interface lives in `agent/gui/`. For an Agent turn, the webview assembles the system message and context, selects available tools, and streams a model response. Tool calls pass through policy evaluation and approval before execution; after the calls settle, the conversation can resume. The host bridge connects the interface to the core runtime, while the workbench runtime channel manages the worker and its lifecycle.

The runtime is built into `out/agent/runtime/`, and the GUI is built into `out/agent/webview/`. These are generated outputs. Changes to source need a rebuild or the appropriate watch pipeline before a running application picks them up. The worker loads provider and tool code in the host process; the webview owns conversation presentation and client-side turn orchestration.

### Agent source map

| Path under `agent/` | Responsibility |
| --- | --- |
| `core/llm/` | Model providers, prompts, streaming, and capability decisions |
| `core/tools/` | Tool definitions, execution, argument handling, and policies |
| `core/config/` | Configuration loading, model setup, and rules |
| `gui/src/` | Agent interface, settings, conversation state, and turn orchestration |
| `workbench/` | Native workbench integration and runtime bridge |
| `packages/` | Shared configuration, fetch, model information, adapters, and terminal policy packages |

Web search is a built-in Agent tool. It sends the query to Exa's hosted MCP endpoint and returns its text results to the model. Browser tools use the browser bridge and are separate from web search. Tool outputs and external page content are data supplied to the model, so users should verify claims and review actions.

## Data and configuration

Agent data defaults to `~/.agent/`; `AGENT_GLOBAL_DIR` can override that location. Sessions, shared configuration, and indexes are stored beneath that directory. Workbench settings and state use the application's own data directory. Model requests and enabled external tools can send selected context to configured services; the destination depends on the chosen provider and tool.
