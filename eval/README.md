# Agent eval

Regression checks for the **Workbench Agent** (`ide/src/vs/workbench/contrib/agent`).

## Run

```bash
cd eval
bun run eval              # harness + fixture cases
bun run eval:harness      # mock LLM driver only
bun run eval:fixture      # workspace verify only
```

Requires **Bun**. First run builds agent packages via `eval/scripts/prereq.sh` (same deps as GUI tests).

## Lanes

| Lane | What it does |
| --- | --- |
| **harness** | Replays `transcript.json` through `runAgentDriver` (no API keys). Checks tool-call expectations. |
| **fixture** | Copies `workspace/` to a temp dir and runs `verify.command` (tests pass today; used for live-agent cases later). |
| **live** | Not implemented — real models + agent loop (planned). |

## Case layout

```
eval/cases/<case-id>/
  case.json           # manifest
  transcript.json     # harness only — LLM turn script
  workspace/          # fixture only — mini repo
```

Reports: `eval/out/report-*.json` and `eval/out/harness-results.json`.

## Adding a harness case

1. Copy `driver-assistant-only` or `driver-grep-search`.
2. Set `expect_tools` to match tool names (e.g. `grep_search`).
3. Record `transcript.json` turns to mirror expected driver behavior after prompt changes.

Harness runner: `ide/.../contrib/agent/gui/src/eval/harnessRunner.ts`.
