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
