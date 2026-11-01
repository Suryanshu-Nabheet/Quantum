export const OVERLOADED_RETRIES = 3;
export const OVERLOADED_DELAY_MS = 1000;

const RETRIES_EXHAUSTED = Symbol.for("agent.overloadRetriesExhausted");

export function isOverloadedErrorMessage(message?: string | null): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes("overloaded") || lower.includes("malformed json");
}

export function overloadRetryDelayMs(attempt: number): number {
  return OVERLOADED_DELAY_MS * 2 ** attempt;
}

/**
 * Tags an error whose per-turn overload retries were already spent, so an
 * outer retry layer does not re-run the whole agent run for it.
 */
export function markOverloadRetriesExhausted(error: unknown): void {
  if (error && typeof error === "object") {
    (error as Record<symbol, unknown>)[RETRIES_EXHAUSTED] = true;
  }
}

export function overloadRetriesWereExhausted(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    (error as Record<symbol, unknown>)[RETRIES_EXHAUSTED] === true
  );
}
