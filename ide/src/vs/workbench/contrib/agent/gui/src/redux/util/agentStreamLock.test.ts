import { describe, expect, it } from "vitest";
import {
  resetAgentStreamLockForTests,
  withAgentStreamLock,
} from "./agentStreamLock";

describe("withAgentStreamLock", () => {
  it("runs tasks sequentially", async () => {
    resetAgentStreamLockForTests();
    const order: number[] = [];

    const first = withAgentStreamLock(async () => {
      await new Promise((r) => setTimeout(r, 20));
      order.push(1);
    });
    const second = withAgentStreamLock(async () => {
      order.push(2);
    });

    await Promise.all([first, second]);
    expect(order).toEqual([1, 2]);
  });
});
