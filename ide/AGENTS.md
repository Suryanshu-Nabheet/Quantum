# Agent instructions (Quantum)

This repository is **Quantum**, an MIT-licensed fork of Visual Studio Code.

For architecture, coding standards, validation, and layer rules, see [.github/copilot-instructions.md](.github/copilot-instructions.md).

For human contributors, see [README.md](README.md) and [CONTRIBUTING.md](../CONTRIBUTING.md).

Monorepo documentation: [docs/for-agents.md](../docs/for-agents.md) · [Workbench Agent](../docs/products/workbench-agent.md) · [harness reference](../docs/reference/workbench-agent-harness.md).

**First-time dev setup:** `./scripts/setup.sh` (macOS/Linux) or `scripts\setup.bat` (Windows). After a successful build, relaunch with `./scripts/setup.sh --launch-only` or `VSCODE_SKIP_PRELAUNCH=1 ./scripts/code.sh`. Details: [scripts/README.md](scripts/README.md).

## AI Architecture & Boundaries

> [!IMPORTANT]
> **First-Party Agent Scope (`src/vs/workbench/contrib/agent/`)**
> - The **Quantum Workbench Agent** ([`src/vs/workbench/contrib/agent/`](src/vs/workbench/contrib/agent/)) is the sole engine powering all AI features in Quantum IDE (chat sidebar, inline editing, tab autocomplete, plan mode, browser tools, diff apply, and MCP).
> - Upstream editor modules inherited from Microsoft Copilot integrations (`src/vs/workbench/contrib/chat/`, `src/vs/workbench/contrib/inlineChat/`, `src/vs/sessions/`, `src/vs/platform/chat/`) are inactive upstream components and must not be used or modified.
> - Always direct all AI-related development, prompt changes, tool additions, and bug fixes to `src/vs/workbench/contrib/agent/`.

## Workflow rules (mandatory)

These rules apply to **every** change. Do not skip them.

1. **Verify before you commit.** Never commit a change to the agent harness (`src/vs/workbench/contrib/agent/**`) until it passes the verification loop:
   - From `src/vs/workbench/contrib/agent/`: `npm run tsc:check` (host) is green
   - From `src/vs/workbench/contrib/agent/`: `npm test` (core Vitest suite) is green
   - From `src/vs/workbench/contrib/agent/`: `npm --prefix gui run tsc:check` and `npm --prefix gui test` are green
   - For any local package you touch, its `npm run build` (tsc) is green
   Do not carry forward historical failure baselines. The required state is zero failures; investigate and resolve failures before treating verification as complete.

2. **Test in the desktop before you commit.** After the build/test loop is green, launch Code OSS and smoke-test the affected feature in the desktop before pushing. Use the launch skill (`.agents/skills/launch/SKILL.md`): build, launch with `./scripts/code.sh --remote-debugging-port=9224`, attach with `@playwright/cli`, exercise the changed feature, and take a screenshot as proof. If the desktop environment is genuinely unavailable (no display / build infeasible in the current run), say so explicitly and rely on the build+test loop above — do not silently skip it. Always kill Code OSS when done.

3. **Commit on `main` only.** Work on the `main` branch. Do not create `cursor/*` branches. Do not amend or force-push.

4. **Author as Suryanshu Nabheet, never as "Cursor Agent".** Commit with `git -c user.name="Suryanshu Nabheet" -c user.email="Suryanshu-Nabheet@users.noreply.github.com" commit ...`. The repo's default git identity is "Cursor Agent" — override it per-commit so the history shows the founder's name, not the agent's.

5. **One logical change per commit.** Don't batch unrelated work. Push with `git push origin main` after each commit.

6. **No new logic when cleaning.** When the task is cleanup/lightweighting, remove dead code only. Don't add new loops, abstractions, or features. Prove each deletion is unused (no static/dynamic import, no barrel re-export, not in a provider registry, not part of the public `core/index.d.ts` API) before removing it.

## Agent harness (webview loop)

Production agent turns flow through: `streamModelTurn` → tool policy → `runParallelToolCalls` / `callToolById` → `streamResponseAfterToolCall` → next `streamModelTurn`. Invariants:

- **One LLM stream:** `withAgentStreamLock` on `streamModelTurn` only; parallel tools defer LLM resume via `agentToolPipeline`.
- **Depth:** `agentStepDepth` resets each user message; tool execution uses `agentStepDepth + 1`; `streamResponseAfterToolCall(depth)` starts the next LLM at `depth + 1`.
- **Mixed approval:** auto tools use `resumeAgent: false`; user Accept / Accept all continues when all tools on the turn are done.
- **IPC:** `HostBridge` long timeouts for `tools/call` and `llm/assembleChat`; LLM stream idle 600s.
- **Gateway models:** non–api.openai.com OpenAI-compatible APIs use `parallel_tool_calls: true` (core + openai-adapters).

Before changing the harness, run the Agent checks above and desktop smoke (multi-tool prompt + optional long terminal command). Settings: Agent Access **Full**, Terminal **Auto** for autonomous runs.
