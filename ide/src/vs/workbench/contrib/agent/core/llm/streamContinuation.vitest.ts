import { describe, expect, it } from "vitest";
import {
  assistantMessageHasIncompleteToolCalls,
  buildStreamContinuationMessages,
  isTruncatedFinishReason,
  mergeAssistantStreamChunk,
  shouldContinueLlmStream,
} from "./streamContinuation.js";

describe("streamContinuation", () => {
  it("merges assistant text across chunks", () => {
    const merged = mergeAssistantStreamChunk(
      { role: "assistant", content: "Hello " },
      { role: "assistant", content: "world" },
    );
    expect(render(merged)).toBe("Hello world");
  });

  it("detects incomplete tool arguments", () => {
    expect(
      assistantMessageHasIncompleteToolCalls({
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "1",
            type: "function",
            function: { name: "read_file", arguments: '{"path":' },
          },
        ],
      }),
    ).toBe(true);
  });

  it("builds continuation transcript", () => {
    const msgs = buildStreamContinuationMessages(
      [{ role: "user", content: "hi" }],
      { role: "assistant", content: "partial" },
      {
        modelTitle: "m",
        modelProvider: "p",
        prompt: "",
        completion: "partial",
      },
    );
    expect(msgs).toHaveLength(3);
    expect(msgs[2].role).toBe("user");
  });

  it("continues when the model stops at a dangling lead-in", () => {
    expect(
      shouldContinueLlmStream(
        {
          modelTitle: "m",
          modelProvider: "p",
          prompt: "",
          completion:
            "I now have a comprehensive understanding of the codebase. Here's my analysis:",
          finishReason: "stop",
        },
        {
          role: "assistant",
          content:
            "I now have a comprehensive understanding of the codebase. Here's my analysis:",
        },
      ),
    ).toBe(true);
  });

  it("does not continue a normal complete sentence", () => {
    const text =
      "Let me explore the agent directory and the main VS source structure.";
    expect(
      shouldContinueLlmStream(
        {
          modelTitle: "m",
          modelProvider: "p",
          prompt: "",
          completion: text,
          finishReason: "stop",
        },
        { role: "assistant", content: text },
      ),
    ).toBe(false);
  });

  it("does not continue when the assistant gave a complete answer", () => {
    expect(
      shouldContinueLlmStream(
        {
          modelTitle: "m",
          modelProvider: "p",
          prompt: "",
          completion: "Here is the summary:\n\nThe agent package lives under contrib.",
          finishReason: "stop",
        },
        {
          role: "assistant",
          content:
            "Here is the summary:\n\nThe agent package lives under contrib.",
        },
      ),
    ).toBe(false);
  });

  it("shouldContinueLlmStream on length finish", () => {
    expect(
      shouldContinueLlmStream(
        {
          modelTitle: "m",
          modelProvider: "p",
          prompt: "",
          completion: "x",
          finishReason: "length",
        },
        undefined,
      ),
    ).toBe(true);
  });
});

function render(message: { role: string; content?: unknown }): string {
  if (typeof message.content === "string") {
    return message.content;
  }
  return "";
}
