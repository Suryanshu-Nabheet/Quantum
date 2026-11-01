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

- The webview renders the conversation and currently owns the Redux session
  state and turn loop in `gui/src/redux/thunks`.
- `core` owns provider adapters, prompts, tool and MCP implementations, and
  history storage. `workbench/common/agentTurnPolicy.ts` owns shared turn
  decisions, and `workbench/runtime/AgentRuntime.ts` constructs Core inside
  the Node worker.
- `workbench/electron-browser` maps Agent requests to IDE services such as
  editors, files, terminals, SCM, browser views, and secret storage.
- `workbench/electron-main` creates and disposes the worker for each window.

This is a native workbench integration, but turn orchestration and session
state are still split between the GUI and Core. The GUI also uses a webview
message bridge. Those are remaining runtime ownership boundaries; this
document does not claim that the Agent loop has already moved into the
workbench. Continuation decisions and loop limits are now centralized in
`workbench/common/agentTurnPolicy.ts`; the GUI still owns the driver loop and session
mutations.

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
