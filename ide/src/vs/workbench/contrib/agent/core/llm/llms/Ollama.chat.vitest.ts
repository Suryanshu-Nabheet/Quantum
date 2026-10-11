import { expect, test } from "vitest";
import { convertToOllamaMessages } from "./Ollama";

test("replays a tool call and its result in Ollama's shape", () => {
  const messages = convertToOllamaMessages([
    { role: "user", content: "analyse the codebase" },
    { role: "thinking", content: "I should list the project" },
    {
      role: "assistant",
      content: "",
      toolCalls: [
        {
          id: "call-1",
          type: "function",
          function: { name: "ls", arguments: '{"dirPath":"."}' },
        },
      ],
    },
    { role: "tool", content: "package.json\nsrc", toolCallId: "call-1" },
  ]);

  expect(messages.map((message) => message.role)).toEqual([
    "user",
    "assistant",
    "tool",
  ]);
  expect(messages[1].tool_calls?.[0].function).toEqual({
    name: "ls",
    arguments: { dirPath: "." },
  });
  expect(messages[2].tool_name).toBe("ls");
  expect(messages[2].content).toBe("package.json\nsrc");
});
