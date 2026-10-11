import { describe, expect, it } from "vitest";
import {
  appendStreamedAssistantText,
  assistantMessageHasIncompleteToolCalls,
  assistantReplyIsUnfinished,
  buildStreamContinuationMessages,
  isTruncatedFinishReason,
  mergeAssistantStreamChunk,
  shouldContinueLlmStream,
  shouldResumeAgentAfterIdleReply,
  withAgentIdleResumeNudge,
} from "./streamContinuation.js";

describe("streamContinuation", () => {
  it("merges assistant text across chunks", () => {
    const merged = mergeAssistantStreamChunk(
      { role: "assistant", content: "Hello " },
      { role: "assistant", content: "world" },
    );
    expect(render(merged)).toBe("Hello world");
  });

  it("breaks a new sentence that was glued onto punctuation", () => {
    expect(
      appendStreamedAssistantText(
        "Let me read the key files:",
        "I'll analyze the project.",
      ),
    ).toBe("Let me read the key files:\n\nI'll analyze the project.");
  });

  it("treats a lead-in at the end of a long reply as unfinished", () => {
    const text = `${"The project has many files. ".repeat(30)}Let me read the key source files.`;
    expect(assistantReplyIsUnfinished(text)).toBe(true);
    expect(
      assistantReplyIsUnfinished(
        "Based on my analysis, here's what I found about this Next.js project:",
      ),
    ).toBe(true);
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

  it("continues when the model only promised to examine the files", () => {
    const text = "Let me examine the key files to understand how this application works:";
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
    ).toBe(true);
  });

  it("continues when the model only promised to keep looking", () => {
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
    ).toBe(true);
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

  it("resumes an agent turn that stopped after tools", () => {
    expect(
      shouldResumeAgentAfterIdleReply({
        text: "Let me dig deeper into the chat loop.",
        turnAlreadyUsedTools: true,
        hasOpenTodos: false,
      }),
    ).toBe(true);
    expect(
      shouldResumeAgentAfterIdleReply({
        text: "",
        turnAlreadyUsedTools: true,
        hasOpenTodos: false,
      }),
    ).toBe(true);
    expect(
      shouldResumeAgentAfterIdleReply({
        text: "x".repeat(600),
        turnAlreadyUsedTools: true,
        hasOpenTodos: false,
      }),
    ).toBe(false);
  });

  it("resumes a first reply that only promised to look", () => {
    expect(
      shouldResumeAgentAfterIdleReply({
        text: "Let me dig deeper into the chat loop.",
        lastUserText: "analyse the codebase",
        turnAlreadyUsedTools: false,
        hasOpenTodos: false,
      }),
    ).toBe(true);
  });

  it("resumes when the model tells the user to run a tool", () => {
    expect(
      shouldResumeAgentAfterIdleReply({
        text: "You can use the ls tool to list the project.",
        lastUserText: "what is in this repo",
        turnAlreadyUsedTools: false,
        hasOpenTodos: false,
      }),
    ).toBe(true);
  });

  it("resumes a short stall on a codebase request", () => {
    expect(
      shouldResumeAgentAfterIdleReply({
        text: "This looks like a Next.js app.",
        lastUserText: "analyze the codebase",
        turnAlreadyUsedTools: false,
        hasOpenTodos: false,
      }),
    ).toBe(true);
  });

  it("resumes an autonomous request that answered without tools", () => {
    expect(
      shouldResumeAgentAfterIdleReply({
        text: "x".repeat(700),
        lastUserText: "analyze the codebase",
        turnAlreadyUsedTools: false,
        hasOpenTodos: false,
      }),
    ).toBe(true);
  });

  it("does not resume a finished answer to an ordinary question", () => {
    expect(
      shouldResumeAgentAfterIdleReply({
        text: "The entry file is src/index.ts and it exports the app.",
        lastUserText: "where is the entry file",
        turnAlreadyUsedTools: false,
        hasOpenTodos: false,
      }),
    ).toBe(false);
  });

  it("resumes while todos are still open", () => {
    expect(
      shouldResumeAgentAfterIdleReply({
        text: "x".repeat(600),
        turnAlreadyUsedTools: false,
        hasOpenTodos: true,
      }),
    ).toBe(true);
  });

  it("appends the idle nudge only after a tool-free assistant message", () => {
    const nudged = withAgentIdleResumeNudge([
      { role: "user", content: "analyse the codebase" },
      { role: "assistant", content: "Let me dig deeper." },
    ]);
    expect(nudged.at(-1)?.role).toBe("user");
    expect(withAgentIdleResumeNudge([
      {
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "1",
            type: "function",
            function: { name: "read_file", arguments: "{}" },
          },
        ],
      },
    ])).toHaveLength(1);
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
