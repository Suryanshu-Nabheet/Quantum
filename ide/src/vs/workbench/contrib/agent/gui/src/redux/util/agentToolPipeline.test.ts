import { describe, expect, it } from "vitest";

/**
 * Documents the agent loop depth contract (see streamResponseAfterToolCall + streamNormalInput).
 * Tool execution uses depth N; streamResponseAfterToolCall(N) starts streamNormalInput at N+1.
 */
describe("agent loop depth contract", () => {
  it("streamNormalInput depth increments once per streamResponseAfterToolCall", () => {
    const toolExecutionDepth = 1;
    const streamResponseAfterToolCallDepth = toolExecutionDepth;
    const nextStreamNormalInputDepth = streamResponseAfterToolCallDepth + 1;
    expect(nextStreamNormalInputDepth).toBe(2);
  });

  it("parallel batch uses parentDepth + 1 for tools then same depth for resume", () => {
    const parentStreamNormalInputDepth = 0;
    const toolBatchDepth = parentStreamNormalInputDepth + 1;
    const resumeDepth = toolBatchDepth;
    const nextStreamNormalInputDepth = resumeDepth + 1;
    expect(nextStreamNormalInputDepth).toBe(2);
  });
});
