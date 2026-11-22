import iconv from "iconv-lite";
import childProcess from "node:child_process";
import os from "node:os";
import { AgentError, AgentErrorReason } from "../../util/errors";
// Automatically decode the buffer according to the platform to avoid garbled Chinese
function getDecodedOutput(data: Buffer): string {
  if (process.platform === "win32") {
    try {
      let out = iconv.decode(data, "utf-8");
      if (/�/.test(out)) {
        out = iconv.decode(data, "gbk");
      }
      return out;
    } catch {
      return iconv.decode(data, "gbk");
    }
  } else {
    return data.toString();
  }
} // Simple helper function to use login shell on Unix/macOS and PowerShell on Windows
function getShellCommand(command: string): { shell: string; args: string[] } {
  if (process.platform === "win32") {
    // Windows: Use PowerShell
    return {
      shell: "powershell.exe",
      args: ["-NoLogo", "-ExecutionPolicy", "Bypass", "-Command", command],
    };
  } else {
    // Unix/macOS: Use login shell to source .bashrc/.zshrc etc.
    const userShell = process.env.SHELL || "/bin/bash";
    return { shell: userShell, args: ["-l", "-c", command] };
  }
}

function toWslPath(windowsOrWslPath: string): string {
  const normalized = windowsOrWslPath.replace(/\\/g, "/");
  const driveMatch = normalized.match(/^([A-Za-z]):\/?(.*)$/);
  if (driveMatch) {
    const rest = driveMatch[2] ? `/${driveMatch[2]}` : "";
    return `/mnt/${driveMatch[1].toLowerCase()}${rest}`;
  }
  return normalized;
}

function getShellCommandForIde(
  command: string,
  options: { useWslFromWindows: boolean; cwd?: string },
): { shell: string; args: string[] } {
  if (options.useWslFromWindows) {
    let wslCommand = command;
    if (options.cwd) {
      const wslCwd = toWslPath(options.cwd);
      wslCommand = `cd ${JSON.stringify(wslCwd)} && ${command}`;
    }
    return {
      shell: "wsl.exe",
      args: ["-e", "bash", "-lc", wslCommand],
    };
  }

  return getShellCommand(command);
}

import { fileURLToPath } from "node:url";
import { ToolImpl } from ".";
import {
  isProcessBackgrounded,
  markProcessAsRunning,
  removeBackgroundedProcess,
  removeRunningProcess,
  updateProcessOutput,
} from "../../util/processTerminalStates";
import { getBooleanArg, getStringArg } from "../parseArgs";

/**
 * Resolves the working directory from workspace dirs.
 * Falls back to home directory or temp directory if no workspace is available.
 */
function resolveWorkingDirectory(workspaceDirs: string[]): string {
  // Handle file:// URIs (local workspaces)
  const fileWorkspaceDir = workspaceDirs.find((dir) =>
    dir.startsWith("file:/"),
  );
  if (fileWorkspaceDir) {
    try {
      return fileURLToPath(fileWorkspaceDir);
    } catch {
      // fileURLToPath can fail on malformed URIs or in some remote environments
      // Fall through to default handling
    }
  }

  // Handle other URI schemes (vscode-remote://wsl, vscode-remote://ssh-remote, etc.)
  const remoteWorkspaceDir = workspaceDirs.find(
    (dir) => dir.includes("://") && !dir.startsWith("file:/"),
  );
  if (remoteWorkspaceDir) {
    try {
      const url = new URL(remoteWorkspaceDir);
      return decodeURIComponent(url.pathname);
    } catch {
      // Fall through to other handlers
    }
  }

  // Default to user's home directory with fallbacks
  try {
    return process.env.HOME || process.env.USERPROFILE || process.cwd();
  } catch {
    // Final fallback if even process.cwd() fails - use system temp directory
    return os.tmpdir();
  }
}

// Add color-supporting environment variables
/** Foreground commands stop being awaited after this long (the process is not killed). */
const FOREGROUND_TIMEOUT_MS = 120_000;

const getColorEnv = () => ({
  ...process.env,
  FORCE_COLOR: "1",
  COLORTERM: "truecolor",
  TERM: "xterm-256color",
  CLICOLOR: "1",
  CLICOLOR_FORCE: "1",
});

export const runTerminalCommandImpl: ToolImpl = async (args, extras) => {
  const command = getStringArg(args, "command");
  // Default to waiting for completion if not specified
  const waitForCompletion =
    getBooleanArg(args, "waitForCompletion", false) ?? true;

  const ideInfo = await extras.ide.getIdeInfo();
  const toolCallId = extras.toolCallId || "";

  // The native worker is local. A remote workspace needs the workbench's
  // integrated terminal so the process runs on the workspace host.
  const useWslFromWindows = process.platform === "win32" && ideInfo.remoteName === "wsl";
  if (["", "local"].includes(ideInfo.remoteName) || useWslFromWindows) {
    // For streaming output
    if (extras.onPartialOutput) {
      try {
        const workspaceDirs = await extras.ide.getWorkspaceDirs();
        const cwd = resolveWorkingDirectory(workspaceDirs);

        return new Promise((resolve, reject) => {
          let terminalOutput = "";

          if (!waitForCompletion) {
            const status = "Command is running in the background...";
            if (extras.onPartialOutput) {
              extras.onPartialOutput({
                toolCallId,
                contextItems: [
                  {
                    name: "Terminal",
                    description: "Terminal command output",
                    content: "",
                    status: status,
                  },
                ],
              });
            }
          }

          const { shell, args } = getShellCommandForIde(command, {
            useWslFromWindows,
            cwd,
          });
          const childProc = childProcess.spawn(shell, args, {
            cwd: useWslFromWindows ? undefined : cwd,
            env: getColorEnv(),
          });

          // Track this process for foreground cancellation
          if (toolCallId && waitForCompletion) {
            markProcessAsRunning(
              toolCallId,
              childProc,
              extras.onPartialOutput,
              terminalOutput,
              () => resolve([{
                name: "Terminal",
                description: "Terminal command output",
                content: terminalOutput,
                status: "Command moved to background. Further output will be ignored.",
              }]),
            );
          }

          childProc.stdout?.on("data", (data) => {
            // Skip if this process has been backgrounded
            if (isProcessBackgrounded(toolCallId)) return;

            const newOutput = getDecodedOutput(data);
            terminalOutput += newOutput;

            // Update the tracked output for potential cancellation notifications
            if (toolCallId && waitForCompletion) {
              updateProcessOutput(toolCallId, terminalOutput);
            }

            // Send partial output to UI
            if (extras.onPartialOutput) {
              const status = waitForCompletion
                ? ""
                : "Command is running in the background...";
              extras.onPartialOutput({
                toolCallId,
                contextItems: [
                  {
                    name: "Terminal",
                    description: "Terminal command output",
                    content: terminalOutput,
                    status: status,
                  },
                ],
              });
            }
          });

          childProc.stderr?.on("data", (data) => {
            // Skip if this process has been backgrounded
            if (isProcessBackgrounded(toolCallId)) return;

            const newOutput = getDecodedOutput(data);
            terminalOutput += newOutput;

            // Update the tracked output for potential cancellation notifications
            if (toolCallId && waitForCompletion) {
              updateProcessOutput(toolCallId, terminalOutput);
            }

            // Send partial output to UI, status is not required
            if (extras.onPartialOutput) {
              extras.onPartialOutput({
                toolCallId,
                contextItems: [
                  {
                    name: "Terminal",
                    description: "Terminal command output",
                    content: terminalOutput,
                  },
                ],
              });
            }
          });

          // If we don't need to wait for completion, resolve immediately
          if (!waitForCompletion) {
            const status = "Command is running in the background...";
            resolve([
              {
                name: "Terminal",
                description: "Terminal command output",
                content: terminalOutput,
                status: status,
              },
            ]);
          }

          childProc.on("close", (code) => {
            // Clean up process tracking
            if (toolCallId) {
              if (isProcessBackgrounded(toolCallId)) {
                removeBackgroundedProcess(toolCallId);
                return;
              }
              // Remove from foreground tracking if it was tracked
              removeRunningProcess(toolCallId);
            }

            if (waitForCompletion) {
              // Normal completion, resolve now
              if (!code || code === 0) {
                const status = "Command completed";
                resolve([
                  {
                    name: "Terminal",
                    description: "Terminal command output",
                    content: terminalOutput,
                    status: status,
                  },
                ]);
              } else {
                const status = `Command failed with exit code ${code}`;
                resolve([
                  {
                    name: "Terminal",
                    description: "Terminal command output",
                    content: terminalOutput,
                    status: status,
                  },
                ]);
              }
            } else {
              // Already resolved, just update the UI with final output
              if (extras.onPartialOutput) {
                const status =
                  code === 0 || !code
                    ? "\nBackground command completed"
                    : `\nBackground command failed with exit code ${code}`;
                extras.onPartialOutput({
                  toolCallId,
                  contextItems: [
                    {
                      name: "Terminal",
                      description: "Terminal command output",
                      content: terminalOutput,
                      status: status,
                    },
                  ],
                });
              }
            }
          });

          childProc.on("error", (error) => {
            // Clean up process tracking
            if (toolCallId) {
              if (isProcessBackgrounded(toolCallId)) {
                removeBackgroundedProcess(toolCallId);
                return;
              }
              // Remove from foreground tracking if it was tracked
              removeRunningProcess(toolCallId);
            }

            reject(error);
          });
        });
      } catch (error: any) {
        throw error;
      }
    } else {
      // Fallback to non-streaming for older clients
      const workspaceDirs = await extras.ide.getWorkspaceDirs();
      const cwd = resolveWorkingDirectory(workspaceDirs);

      if (waitForCompletion) {
        // Standard execution, waiting for completion
        try {
          // Use spawn approach for consistency with streaming version
          const { shell: nonStreamingShell, args: nonStreamingArgs } =
            getShellCommandForIde(command, { useWslFromWindows, cwd });
          const output = await new Promise<{ stdout: string; stderr: string }>(
            (resolve, reject) => {
              const childProc = childProcess.spawn(
                nonStreamingShell,
                nonStreamingArgs,
                {
                  cwd: useWslFromWindows ? undefined : cwd,
                  env: getColorEnv(),
                },
              );

              // Track this process for foreground cancellation
              if (toolCallId) {
                markProcessAsRunning(toolCallId, childProc, undefined, "");
              }

              let stdout = "";
              let stderr = "";

              childProc.stdout?.on("data", (data) => {
                stdout += getDecodedOutput(data);
              });

              childProc.stderr?.on("data", (data) => {
                stderr += getDecodedOutput(data);
              });

              // Bound foreground waits so a hung command cannot hold the agent's
              // stream lock indefinitely. The process is not killed: the model is
              // told it may still be running.
              const timer = setTimeout(() => {
                if (toolCallId) {
                  removeRunningProcess(toolCallId);
                }
                reject(
                  new AgentError(
                    AgentErrorReason.CommandExecutionFailed,
                    `Command timed out after ${FOREGROUND_TIMEOUT_MS / 1000}s and may still be running. Check the terminal output or run a shorter command.`,
                  ),
                );
              }, FOREGROUND_TIMEOUT_MS);

              childProc.on("close", (code) => {
                clearTimeout(timer);
                // Clean up process tracking
                if (toolCallId) {
                  removeRunningProcess(toolCallId);
                }

                if (code === 0) {
                  resolve({ stdout, stderr });
                } else {
                  const error = new AgentError(
                    AgentErrorReason.CommandExecutionFailed,
                    `Command failed with exit code ${code}`,
                  );
                  (error as any).stderr = stderr;
                  reject(error);
                }
              });

              childProc.on("error", (error) => {
                clearTimeout(timer);
                // Clean up process tracking
                if (toolCallId) {
                  removeRunningProcess(toolCallId);
                }
                reject(error);
              });
            },
          );

          const status = "Command completed";
          return [
            {
              name: "Terminal",
              description: "Terminal command output",
              content: output.stdout ?? "",
              status: status,
            },
          ];
        } catch (error: any) {
          const status = `Command failed with: ${error.message || error.toString()}`;
          return [
            {
              name: "Terminal",
              description: "Terminal command output",
              content: error.stderr ?? error.toString(),
              status: status,
            },
          ];
        }
      } else {
        // For non-streaming but also not waiting for completion, use spawn
        // but don't attach any listeners other than error
        try {
          // Use spawn with color environment
          const { shell: detachedShell, args: detachedArgs } =
            getShellCommandForIde(command, { useWslFromWindows, cwd });
          const childProc = childProcess.spawn(detachedShell, detachedArgs, {
            cwd: useWslFromWindows ? undefined : cwd,
            env: getColorEnv(),
            // Detach the process so it's not tied to the parent
            detached: true,
            // Redirect to /dev/null equivalent (works cross-platform)
            stdio: "ignore",
          });

          // Even for detached processes, add event handlers to clean up the background process map
          childProc.on("close", () => {
            if (isProcessBackgrounded(toolCallId)) {
              removeBackgroundedProcess(toolCallId);
            }
          });

          childProc.on("error", () => {
            if (isProcessBackgrounded(toolCallId)) {
              removeBackgroundedProcess(toolCallId);
            }
          });

          // Unref the child to allow the Node.js process to exit
          childProc.unref();
          const status = "Command is running in the background...";
          return [
            {
              name: "Terminal",
              description: "Terminal command output",
              content: status,
              status: status,
            },
          ];
        } catch (error: any) {
          const status = `Command failed with: ${error.message || error.toString()}`;
          return [
            {
              name: "Terminal",
              description: "Terminal command output",
              content: status,
              status: status,
            },
          ];
        }
      }
    }
  }

  const result = await extras.ide.runCommand(command, {
    terminalName: "Agent",
    reuseTerminal: false,
    waitForCompletion,
  });

  let status = "Sent to terminal";
  if (result?.exitCode !== undefined) {
    status = result.exitCode === 0
      ? "Command completed"
      : `Command failed with exit code ${result.exitCode}`;
  }

  return [{
    name: "Terminal",
    description: "Terminal command output",
    content: result?.output ?? "Command sent to the integrated Agent terminal.",
    status,
  }];
};
