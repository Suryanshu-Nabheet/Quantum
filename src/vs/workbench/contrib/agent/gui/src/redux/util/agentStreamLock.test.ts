import { describe, expect, it } from "vitest";
import { withAgentStreamLock } from "./agentStreamLock";

describe("withAgentStreamLock", () => {
  it("serializes tasks so only one runs at a time", async () => {
    const order: string[] = [];
    let active = 0;
    let maxActive = 0;

    const task = (name: string, ms: number) =>
      withAgentStreamLock(async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        order.push(`start:${name}`);
        await new Promise((resolve) => setTimeout(resolve, ms));
        order.push(`end:${name}`);
        active--;
        return name;
      });

    const results = await Promise.all([
      task("a", 20),
      task("b", 5),
      task("c", 1),
    ]);

    expect(results).toEqual(["a", "b", "c"]);
    expect(maxActive).toBe(1);
    expect(order).toEqual([
      "start:a",
      "end:a",
      "start:b",
      "end:b",
      "start:c",
      "end:c",
    ]);
  });

  it("releases the lock when a task throws", async () => {
    await expect(
      withAgentStreamLock(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    const next = await withAgentStreamLock(async () => "recovered");
    expect(next).toBe("recovered");
  });

  it("does not deadlock when a nested call runs after the outer task releases", async () => {
    // Mirrors the driver: the outer stream releases the lock before the
    // post-stream phase, which may start another turn under the lock.
    const outer = await withAgentStreamLock(async () => "stream-done");
    const nested = await withAgentStreamLock(async () => `${outer}+turn`);
    expect(nested).toBe("stream-done+turn");
  });
});
