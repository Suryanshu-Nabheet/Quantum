import { describe, expect, it } from "vitest";
import {
  stripMarkdownJsonToolCallFromAssistantText,
  tryParseMarkdownJsonToolCall,
} from "./markdownJsonToolCall.js";

describe("markdownJsonToolCall", () => {
  it("parses fenced json tool calls", () => {
    const text = `Here is the call:
\`\`\`json
{
  "name": "read_file",
  "arguments": {
    "filepath": "readme.md"
  }
}
\`\`\``;
    const delta = tryParseMarkdownJsonToolCall(text);
    expect(delta?.function?.name).toBe("read_file");
    expect(JSON.parse(delta?.function?.arguments ?? "{}")).toEqual({
      filepath: "readme.md",
    });
  });

  it("removes the tool-call fence and preserves the following code example", () => {
    const call = '```json\n{"name":"read_file","arguments":{}}\n```';
    const code = "```ts\nconst example = true;\n```";
    const text = `Prefix\n${call}\n${code}`;
    expect(stripMarkdownJsonToolCallFromAssistantText(text)).toBe(`Prefix\n\n${code}`);
  });
});
