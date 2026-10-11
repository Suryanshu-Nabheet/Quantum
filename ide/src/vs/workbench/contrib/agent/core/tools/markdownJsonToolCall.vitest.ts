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

  it("strips json fences from assistant text", () => {
    const text = "Prefix\n```json\n{}\n```\n";
    expect(stripMarkdownJsonToolCallFromAssistantText(text)).toBe("Prefix");
  });
});
