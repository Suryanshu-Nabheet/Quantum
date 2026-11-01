import { describe, expect, it } from "vitest";
import {
  isOverloadedErrorMessage,
  markOverloadRetriesExhausted,
  OVERLOADED_DELAY_MS,
  OVERLOADED_RETRIES,
  overloadRetriesWereExhausted,
  overloadRetryDelayMs,
} from "./overloadRetry";

describe("overload retry policy", () => {
  it("classifies overloaded and malformed-json messages only", () => {
    expect(isOverloadedErrorMessage("Model is overloaded, retry")).toBe(true);
    expect(isOverloadedErrorMessage("Malformed JSON in response")).toBe(true);
    expect(isOverloadedErrorMessage("invalid api key")).toBe(false);
    expect(isOverloadedErrorMessage(undefined)).toBe(false);
  });

  it("doubles the delay per attempt from the base delay", () => {
    expect(overloadRetryDelayMs(0)).toBe(OVERLOADED_DELAY_MS);
    expect(overloadRetryDelayMs(1)).toBe(OVERLOADED_DELAY_MS * 2);
    expect(overloadRetryDelayMs(2)).toBe(OVERLOADED_DELAY_MS * 4);
  });

  it("marks exhausted errors so an outer layer can skip retrying them", () => {
    const err = new Error("overloaded");
    expect(overloadRetriesWereExhausted(err)).toBe(false);
    markOverloadRetriesExhausted(err);
    expect(overloadRetriesWereExhausted(err)).toBe(true);
  });

  it("ignores non-object values when marking or checking", () => {
    expect(() => markOverloadRetriesExhausted("overloaded")).not.toThrow();
    expect(overloadRetriesWereExhausted("overloaded")).toBe(false);
    expect(overloadRetriesWereExhausted(null)).toBe(false);
  });

  it("uses a bounded retry count", () => {
    expect(OVERLOADED_RETRIES).toBeGreaterThan(0);
  });
});
