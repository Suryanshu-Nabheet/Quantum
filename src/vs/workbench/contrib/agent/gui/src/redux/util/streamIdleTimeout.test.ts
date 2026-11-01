import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextWithIdleTimeout } from "./streamIdleTimeout";

describe("nextWithIdleTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves when a chunk arrives before the timeout", async () => {
    const pending = Promise.resolve({ done: false, value: "chunk" });
    await expect(nextWithIdleTimeout(pending, 1000)).resolves.toEqual({
      done: false,
      value: "chunk",
    });
  });

  it("rejects when the stream stays silent past the timeout", async () => {
    const neverResolves = new Promise<never>(() => {});
    const result = nextWithIdleTimeout(neverResolves, 1000);
    const assertion = expect(result).rejects.toThrow(/stopped responding/);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it("clears its timer once the chunk arrives (no leaked timeout)", async () => {
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");
    await nextWithIdleTimeout(Promise.resolve({ done: true }), 1000);
    expect(clearSpy).toHaveBeenCalled();
  });
});
