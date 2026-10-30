# Workbench Agent harness (reference)

Maintainer reference for the **chat / tool turn loop** in `ide/src/vs/workbench/contrib/agent/`.

**Canonical copy:** also documented in [`contrib/agent/README.md`](../../ide/src/vs/workbench/contrib/agent/README.md) and [`ide/AGENTS.md`](../../ide/AGENTS.md).

## Turn flow

Production turns follow:

```
streamModelTurn
  → tool policy evaluation
  → runParallelToolCalls / callToolById
  → streamResponseAfterToolCall
  → streamModelTurn (next iteration)
```

Entry driver: `runAgentDriver` / `runStreamModelTurnLocked` in the GUI redux thunks layer (`gui/src/redux/thunks/streamModelTurn.ts` and related).

## Invariants

| Rule | Detail |
| --- | --- |
| **One LLM stream** | `withAgentStreamLock` on `streamModelTurn` only; parallel tools defer LLM resume via `agentToolPipeline` |
| **Stream continuation** | Handled inside `core/llm/streamChat.ts` (bounded segments when truncated — avoid duplicate GUI re-stream loops) |
| **Step depth** | Resets each user message; tool execution uses `agentStepDepth + 1`; `streamResponseAfterToolCall(depth)` starts next LLM at `depth + 1` |
| **Mixed approval** | Auto-approved tools use `resumeAgent: false`; user Accept / Accept all continues when all tools on the turn complete |
| **IPC timeouts** | `HostBridge`: long timeouts for `tools/call` and `llm/assembleChat`; LLM stream idle ~600s |
| **Gateway models** | Non–`api.openai.com` OpenAI-compatible APIs: `parallel_tool_calls: true` (core + openai-adapters) |

## Reliability

- One terminal outcome per stream; abortable streams
- Bounded errors instead of infinite spinners
- `ensureAgentTurnInactive` when the driver exits
- Invalid tool JSON → surfaced as errors, not silent execution

Prefer removing duplicate listeners and eager imports over new orchestration layers.

## Local Ollama `*coder*` models

Use ` ```tool ` system-message tools (not native `tool_calls`). Post-stream recovery in `markdownJsonToolCall.ts` can turn stray ` ```json ` tool output into a real tool call once.

## Verification (before commit)

From `ide/` (native IDE typecheck):

```bash
npm run compile-check-ts-native
```

From `ide/src/vs/workbench/contrib/agent/` (Agent host, core, and GUI):

```bash
npm run tsc:check
npm test
npm --prefix gui run tsc:check
npm --prefix gui test
npm run verify
```

`npm test` runs the core Vitest suite. `npm run verify` also runs the package and agent-config suites.

**Desktop smoke** after harness changes: launch `./scripts/code.sh`, exercise multi-tool prompt, optional terminal tool — see [`ide/AGENTS.md`](../../ide/AGENTS.md).

## Verification expectation

Verification must complete with zero failures. Historical failure counts are not a baseline; investigate and resolve current failures before merging.

## See also

- [Workbench Agent product doc](../products/workbench-agent.md)
- [For agents](../for-agents.md)
