# Agent instructions (Quantum)

This repository is **Quantum**, an MIT-licensed fork of Visual Studio Code.

For architecture, coding standards, validation, and layer rules, see [.github/copilot-instructions.md](.github/copilot-instructions.md).

For human contributors, see [README.md](README.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

**First-time dev setup:** `./scripts/setup.sh` (macOS/Linux) or `scripts\setup.bat` (Windows). After a successful build, relaunch with `./scripts/setup.sh --launch-only` or `VSCODE_SKIP_PRELAUNCH=1 ./scripts/code.sh`. Details: [scripts/README.md](scripts/README.md).

## Workflow rules (mandatory)

These rules apply to **every** change. Do not skip them.

1. **Verify before you commit.** Never commit a change to the agent harness (`src/vs/workbench/contrib/agent/**`) until it passes the verification loop:
   - `npm run tsc:check` (host) is green
   - `npm test` (host vitest) is green
   - `npm --prefix core run vitest` (core) has no **new** failures vs the known baseline
   - `npm --prefix gui run tsc:check` (GUI) is green
   - `npm --prefix gui test` (GUI) has no **new** failures vs the known baseline
   - For any local package you touch, its `npm run build` (tsc) is green
   Known pre-existing baselines (do not "fix" these by accident, and do not introduce new ones): core has 1 failing test in `core/tools/implementations/runTerminalCommand.vitest.ts`; GUI has 14 failing tests across `gui/src/redux/thunks/streamResponse*.test.ts`. A change is only safe if the failure count does not increase.

2. **Test in the desktop before you commit.** After the build/test loop is green, launch Code OSS and smoke-test the affected feature in the desktop before pushing. Use the launch skill (`.agents/skills/launch/SKILL.md`): build, launch with `./scripts/code.sh --remote-debugging-port=9224`, attach with `@playwright/cli`, exercise the changed feature, and take a screenshot as proof. If the desktop environment is genuinely unavailable (no display / build infeasible in the current run), say so explicitly and rely on the build+test loop above — do not silently skip it. Always kill Code OSS when done.

3. **Commit on `main` only.** Work on the `main` branch. Do not create `cursor/*` branches. Do not amend or force-push.

4. **Author as Suryanshu Nabheet, never as "Cursor Agent".** Commit with `git -c user.name="Suryanshu Nabheet" -c user.email="Suryanshu-Nabheet@users.noreply.github.com" commit ...`. The repo's default git identity is "Cursor Agent" — override it per-commit so the history shows the founder's name, not the agent's.

5. **One logical change per commit.** Don't batch unrelated work. Push with `git push origin main` after each commit.

6. **No new logic when cleaning.** When the task is cleanup/lightweighting, remove dead code only. Don't add new loops, abstractions, or features. Prove each deletion is unused (no static/dynamic import, no barrel re-export, not in a provider registry, not part of the public `core/index.d.ts` API) before removing it.
