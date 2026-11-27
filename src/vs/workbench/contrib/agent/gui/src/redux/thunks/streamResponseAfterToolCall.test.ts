import { describe, expect, it } from "vitest";
import { ChatHistoryItemWithMessageId } from "../slices/sessionSlice";
import { canResumeAfterToolCall } from "./streamResponseAfterToolCall";

describe("tool continuation gate", () => {
  it("does not resume an old tool after a response or a new user message", () => {
    const history: ChatHistoryItemWithMessageId[] = [
      {
        message: { id: "assistant", role: "assistant", content: "" },
        contextItems: [],
        toolCallStates: [{
          status: "done",
          toolCallId: "call-1",
          toolCall: { id: "call-1", type: "function", function: { name: "read_file", arguments: "{}" } },
          parsedArgs: {},
        }],
      },
      { message: { id: "tool", role: "tool", toolCallId: "call-1", content: "result" }, contextItems: [] },
    ];
    expect(canResumeAfterToolCall(history, "call-1", false)).toBe(true);
    expect(canResumeAfterToolCall([...history, { message: { id: "reply", role: "assistant", content: "Done." }, contextItems: [] }], "call-1", false)).toBe(false);
    expect(canResumeAfterToolCall([...history, { message: { id: "user", role: "user", content: "Next" }, contextItems: [] }], "call-1", false)).toBe(false);
  });
});
