/** Max silence from the model stream before the turn is treated as stalled. */
export const STREAM_IDLE_TIMEOUT_MS = 90_000;

/**
 * Awaits the next chunk from a stream, rejecting if the stream stays silent
 * longer than `timeoutMs`. Prevents a stalled provider connection from holding
 * the agent stream lock indefinitely.
 */
export function nextWithIdleTimeout<T>(
  pending: Promise<T>,
  timeoutMs: number = STREAM_IDLE_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          `The model stopped responding for ${timeoutMs / 1000}s. Stop the turn and try again.`,
        ),
      );
    }, timeoutMs);
  });
  return Promise.race([pending, timeout]).finally(() => clearTimeout(timer));
}
