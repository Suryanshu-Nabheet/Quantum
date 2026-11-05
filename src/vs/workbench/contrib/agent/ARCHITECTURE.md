# Quantum Agent architecture

Quantum Agent is a first-party IDE feature. It is registered by the workbench
and does not use extension activation or an Agent extension manifest. The
existing conversation UI remains a bundled webview.

## Workbench layers

- `workbench/common` contains service identifiers and contracts shared across
  workbench layers. It must not depend on Electron implementations or the GUI.
- `workbench/browser` registers portable workbench contributions: the view
  container, commands, keybindings, settings, and browser integrations.
- `workbench/electron-browser` owns the desktop view pane and renderer-side
  services that communicate with the shared process.
- `workbench/electron-main` owns the per-window Agent worker lifecycle and IPC.
- `workbench/runtime` is the Node worker entry point. It adapts the existing
  Agent runtime to the workbench-owned process boundary.

The Agent view pane is registered by the desktop entry point. Browser
contributions depend only on contracts from `workbench/common`; they must not
import Electron service implementations.

## Current runtime ownership

- The workbench persists the active session identity, and Core owns transcript
  history on disk. The webview renders a Redux projection and performs
  one-step model and tool execution in `gui/src/redux/thunks`.
- `core` owns provider adapters, prompts, tool and MCP implementations, and
  history storage. `workbench/common/agentTurnPolicy.ts` owns shared turn
  decisions, and `workbench/runtime/AgentRuntime.ts` constructs Core and the
  runtime inside the Node worker.
- `workbench/electron-browser` maps Agent requests to IDE services such as
  editors, files, terminals, SCM, browser views, and secret storage.
- `workbench/electron-main` creates and disposes the worker for each window.

The workbench routes history list/load/save/delete/clear operations, stores the
active session id, and restores the selected session before passing it to the
webview; Core stores transcript, todo, and plan data. Turn orchestration,
approval handling, and the live session projection still run in the React
webview. Moving the chat surface, turn orchestration, and session mutations
into native workbench code remains unfinished.

## Runtime constraints

- Keep Node-only provider and tool dependencies out of the workbench renderer.
- Keep long-running model and tool work off the UI thread.
- Coalesce adjacent runtime stream yields in bounded batches before crossing
  worker IPC; preserve each logical chunk when delivering it to the webview.
- Preserve the per-window worker lifecycle and dispose pending operations when
  its owning window closes.
- On window close, abort outstanding completions and host requests, await Core
  cleanup, then terminate the worker after acknowledgement or a bounded timeout.
- Treat session history and tool approval state as user data; migrate their
  ownership only with compatibility and recovery behavior preserved.
- Preserve the current conversation UI while changing its runtime contract.
- Keep source maps in watch builds; minify the packaged Node runtime without
  emitting maps.

Startup time, memory, and packaged size have not been measured against a
pre-migration baseline. Record those measurements before making performance or
size claims.
