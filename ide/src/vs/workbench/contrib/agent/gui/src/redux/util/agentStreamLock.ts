/**
 * Ensures only one agent LLM stream runs at a time in the webview.
 * Parallel tool completion used to race multiple continuations and truncate replies.
 */
let streamLock: Promise<void> = Promise.resolve();

export function withAgentStreamLock<T>(task: () => Promise<T>): Promise<T> {
  const run = streamLock.then(task, task);
  streamLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** Test-only reset */
export function resetAgentStreamLockForTests(): void {
  streamLock = Promise.resolve();
}
