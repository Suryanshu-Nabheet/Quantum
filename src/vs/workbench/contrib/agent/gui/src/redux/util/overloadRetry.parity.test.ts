import { describe, expect, it } from "vitest";
import { isOverloadedErrorMessage } from "./overloadRetry";

// The original StreamError guard, reproduced verbatim, must agree with the
// shared predicate on every input the dialog can receive.
function originalStreamErrorGuard(message?: string | null): boolean {
  return !!(
    message &&
    (message.toLowerCase().includes("overloaded") ||
      message.toLowerCase().includes("malformed json"))
  );
}

describe("StreamError classification parity", () => {
  const cases: (string | null | undefined)[] = [
    undefined,
    null,
    "",
    "Model is OVERLOADED right now",
    "Malformed JSON in stream",
    "invalid api key",
    "overloaded",
  ];
  for (const c of cases) {
    it(`agrees for ${JSON.stringify(c)}`, () => {
      expect(isOverloadedErrorMessage(c)).toBe(originalStreamErrorGuard(c));
    });
  }
});
