import { describe, expect, it, vi } from "vitest";
import { createStreamRenderBatcher } from "./streamRenderBatch";

describe("createStreamRenderBatcher", () => {
  it("flushes queued messages on flushNow", () => {
    const dispatched: unknown[] = [];
    const batcher = createStreamRenderBatcher(((action: {
      type: string;
      payload: unknown;
    }) => {
      dispatched.push(action);
    }) as never);

    batcher.push([
      { role: "assistant", content: "hello" },
      { role: "assistant", content: " world" },
    ]);
    batcher.flushNow();

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "session/streamUpdate",
      payload: [
        { role: "assistant", content: "hello" },
        { role: "assistant", content: " world" },
      ],
    });
  });

  it("coalesces pushes into a single microtask flush", async () => {
    const dispatched: unknown[] = [];
    const batcher = createStreamRenderBatcher(((action: {
      type: string;
      payload: unknown;
    }) => {
      dispatched.push(action);
    }) as never);

    batcher.push([{ role: "assistant", content: "a" }]);
    batcher.push([{ role: "assistant", content: "b" }]);
    expect(dispatched).toHaveLength(0);

    await Promise.resolve();

    expect(dispatched).toHaveLength(1);
    expect((dispatched[0] as { payload: unknown[] }).payload).toHaveLength(2);
  });
});
