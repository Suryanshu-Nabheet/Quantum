# Agent reliability contract

This document is intentionally scoped to the embedded IDE agent in this
directory. It is a maintenance memory for future changes, not a user prompt.

## Runtime invariants

- A stream must have one terminal outcome: success, cancellation, or one
  surfaced error. Never send multiple terminal protocol responses for one
  message id.
- Every model/tool stream must be abortable. Abort controllers must be
  released after completion, failure, cancellation, and disposal.
- A lost provider or extension-host message must become a bounded, actionable
  error rather than an infinite spinner.
- Interrupted tool calls must never execute with partial arguments.
- Tool-call compatibility parsing must consume provider markers completely and
  must never expose protocol syntax as assistant-visible text.
- Runtime activation and configuration loading must be lazy, retryable, and
  coalesced. Optional providers and embedding runtimes must not load on the
  critical startup path.
- Do not add automatic replay of an agent turn unless all tool, file, terminal,
  and browser side effects are deduplicated. Retrying a partially executed turn
  can duplicate destructive work.

## Change discipline

- Keep changes inside `agent/` unless a direct protocol contract requires a
  coordinated edit elsewhere in the IDE.
- Prefer deleting dead startup work, duplicate listeners, eager imports, and
  redundant state transitions over adding another orchestration layer.
- Add a focused regression test for every stream, parser, lifecycle, or
  cancellation bug.
- Validate with the configured core Vitest suite, agent typecheck, GUI typecheck,
  and production agent build when practical. Treat missing external services
  (provider keys, Docker, local model servers) as environment limitations and
  keep deterministic tests independent of them.
- Do not claim an agent change is perfect without reporting the exact validation
  results and any environment or test-harness limitations.

## Commit standard

Agent commits must use a long, complete message. The message should explain:

1. the user-visible reliability problems and their root causes;
2. each subsystem changed and why it is safe;
3. cleanup and performance effects;
4. tests/builds run, including failures caused by environment or stale tests;
5. known limitations and follow-up risks.
