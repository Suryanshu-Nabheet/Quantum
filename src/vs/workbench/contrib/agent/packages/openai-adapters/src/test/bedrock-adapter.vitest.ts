import { describe, expect, it, vi } from "vitest";
import { ChatCompletionChunk } from "openai/resources/index";

import { BedrockApi } from "../apis/Bedrock.js";

function toolCallChunk(
  partial: ChatCompletionChunk.Choice.Delta.ToolCall,
): ChatCompletionChunk {
  return {
    id: "chunk-1",
    object: "chat.completion.chunk",
    created: Date.now(),
    model: "anthropic.claude-3-sonnet",
    choices: [
      {
        index: 0,
        delta: {
          role: "assistant",
          tool_calls: [partial],
        },
        finish_reason: null,
        logprobs: null,
      },
    ],
  };
}

describe("BedrockApi chatCompletionNonStream", () => {
  it("accumulates streamed tool calls into the final message", async () => {
    const api = new BedrockApi({
      provider: "bedrock",
      apiKey: "test-key",
      env: { region: "us-east-1" },
    });

    vi.spyOn(api, "chatCompletionStream").mockImplementation(async function* () {
      yield toolCallChunk({
        index: 0,
        id: "call_1",
        type: "function",
        function: {
          name: "say_hello",
          arguments: '{"na',
        },
      });
      yield toolCallChunk({
        index: 0,
        type: "function",
        function: {
          arguments: 'me":"Nate"}',
        },
      });
    });

    const result = await api.chatCompletionNonStream(
      {
        model: "anthropic.claude-3-sonnet",
        messages: [{ role: "user", content: "hi" }],
      },
      new AbortController().signal,
    );

    expect(result.choices[0].finish_reason).toBe("tool_calls");
    expect(result.choices[0].message.tool_calls).toEqual([
      {
        id: "call_1",
        type: "function",
        function: {
          name: "say_hello",
          arguments: '{"name":"Nate"}',
        },
      },
    ]);
  });
});
