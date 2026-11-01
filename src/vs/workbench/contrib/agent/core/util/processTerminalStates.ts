import { ChildProcess } from "child_process";

// Track which processes have been backgrounded
const processTerminalBackgroundStates = new Map<string, boolean>();

// Track which foreground processes are currently running
interface RunningProcessInfo {
  process: ChildProcess;
  onPartialOutput?: (params: {
    toolCallId: string;
    contextItems: any[];
  }) => void;
  currentOutput: string;
}

const processTerminalForegroundStates = new Map<string, RunningProcessInfo>();

// Background process functions (existing)
export function markProcessAsBackgrounded(toolCallId: string): void {
  processTerminalBackgroundStates.set(toolCallId, true);
}

export function isProcessBackgrounded(toolCallId: string): boolean {
  return processTerminalBackgroundStates.has(toolCallId);
}

export function removeBackgroundedProcess(toolCallId: string): void {
  processTerminalBackgroundStates.delete(toolCallId);
}

// Foreground process functions (new)
export function markProcessAsRunning(
  toolCallId: string,
  process: ChildProcess,
  onPartialOutput?: (params: {
    toolCallId: string;
    contextItems: any[];
  }) => void,
  currentOutput: string = "",
): void {
  processTerminalForegroundStates.set(toolCallId, {
    process,
    onPartialOutput,
    currentOutput,
  });
}

export function isProcessRunning(toolCallId: string): boolean {
  return processTerminalForegroundStates.has(toolCallId);
}

export function getRunningProcess(
  toolCallId: string,
): ChildProcess | undefined {
  const info = processTerminalForegroundStates.get(toolCallId);
  return info?.process;
}

export function updateProcessOutput(toolCallId: string, output: string): void {
  const info = processTerminalForegroundStates.get(toolCallId);
  if (info) {
    info.currentOutput = output;
  }
}

export function removeRunningProcess(toolCallId: string): void {
  processTerminalForegroundStates.delete(toolCallId);
}

export async function killTerminalProcess(
  toolCallId: string,
  waitForExit = false,
): Promise<void> {
  const processInfo = processTerminalForegroundStates.get(toolCallId);
  if (!processInfo) {
    return;
  }

  const child = processInfo.process;
  let forceKillTimeout: ReturnType<typeof setTimeout> | undefined;
  let giveUpTimeout: ReturnType<typeof setTimeout> | undefined;
  let resolveExit = () => {};
  let settled = false;
  const exited = new Promise<void>((resolve) => (resolveExit = resolve));
  const finish = () => {
    if (settled) {
      return;
    }
    settled = true;
    if (forceKillTimeout) {
      clearTimeout(forceKillTimeout);
    }
    if (giveUpTimeout) {
      clearTimeout(giveUpTimeout);
    }
    processTerminalForegroundStates.delete(toolCallId);
    resolveExit();
  };

  if (child.exitCode != null || child.signalCode != null) {
    finish();
    return;
  }
  const canObserveExit = typeof child.once === "function";
  if (canObserveExit) {
    child.once("exit", finish);
  }

  try {
    child.kill("SIGTERM");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") {
      finish();
      throw error;
    }
    finish();
  }

  processTerminalForegroundStates.delete(toolCallId);
  if (!settled) {
    forceKillTimeout = setTimeout(() => {
      if (child.exitCode == null && child.signalCode == null) {
        try {
          child.kill("SIGKILL");
        } catch {
          finish();
        }
      }
    }, 5000);
  }
  if (waitForExit && !settled && canObserveExit) {
    const waitLimit = new Promise<void>((resolve) => {
      giveUpTimeout = setTimeout(resolve, 6000);
    });
    await Promise.race([exited, waitLimit]);
    finish();
  } else if (waitForExit && !settled) {
    // Real ChildProcess instances are observable. Minimal test doubles may not
    // expose EventEmitter methods, so don't hold shutdown open for them.
    finish();
  }
}

// Function to cancel multiple terminal commands at once
export async function killMultipleTerminalProcesses(
  toolCallIds: string[],
): Promise<void> {
  const cancelPromises = toolCallIds.map((toolCallId) =>
    killTerminalProcess(toolCallId),
  );
  await Promise.all(cancelPromises);
}

// Function to cancel ALL currently running terminal commands
export async function killAllRunningTerminalProcesses(): Promise<string[]> {
  const runningIds = getAllRunningProcessIds();
  if (runningIds.length > 0) {
    await Promise.all(runningIds.map((id) => killTerminalProcess(id, true)));
  }
  return runningIds; // Return the IDs that were cancelled
}

// Utility functions
export function getAllRunningProcessIds(): string[] {
  return Array.from(processTerminalForegroundStates.keys());
}

export function getAllBackgroundedProcessIds(): string[] {
  return Array.from(processTerminalBackgroundStates.keys());
}

// Utility function for testing - clears all background process states
export function clearAllBackgroundProcesses(): void {
  processTerminalBackgroundStates.clear();
}
