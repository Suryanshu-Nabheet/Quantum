import { describe, expect, it } from "vitest";
import { groupHistoryTurns, turnIsWorking } from "./groupHistoryTurns";

function user(text: string) {
  return { message: { role: "user", content: text } };
}

function assistant(text: string, tools: string[] = []) {
  return {
    message: { role: "assistant", content: text },
    toolCallStates: tools.map((name) => ({
      status: "done",
      toolCall: { function: { name } },
    })),
  };
}

describe("groupHistoryTurns", () => {
  it("leaves a plain reply outside a work section", () => {
    expect(groupHistoryTurns([user("hi"), assistant("hello")])).toEqual([
      { kind: "user", index: 0 },
      { kind: "plain", indexes: [1] },
    ]);
  });

  it("puts scans and thinking in one section and the last reply outside", () => {
    const history = [
      user("look around"),
      { message: { role: "thinking", content: "checking layout" } },
      assistant("I'll read the files.", ["read_file", "ls"]),
      assistant("Now the packages.", ["read_file"]),
      assistant("The app is a Next.js project."),
    ];
    expect(groupHistoryTurns(history)).toEqual([
      { kind: "user", index: 0 },
      {
        kind: "worked",
        workIndexes: [1, 2, 3],
        answerIndex: 4,
        reasoningOnAnswer: false,
      },
    ]);
  });

  it("keeps an in-progress tool turn as work with no answer yet", () => {
    const history = [user("scan"), assistant("", ["read_file"])];
    expect(groupHistoryTurns(history)[1]).toMatchObject({
      kind: "worked",
      workIndexes: [1],
      answerIndex: null,
    });
    expect(turnIsWorking(history, [1], null, true)).toBe(true);
    expect(turnIsWorking(history, [1], null, false)).toBe(false);
  });

  it("treats a streaming final reply as finished work", () => {
    const history = [
      user("scan"),
      assistant("read", ["read_file"]),
      assistant("Here is what I found."),
    ];
    expect(turnIsWorking(history, [1], 2, true)).toBe(false);
  });
});
