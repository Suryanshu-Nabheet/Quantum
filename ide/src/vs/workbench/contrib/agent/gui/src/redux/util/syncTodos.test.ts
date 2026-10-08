import { describe, expect, it, vi } from "vitest";
import { syncTodosFromToolCall } from "./syncTodos";

const validArgs = JSON.stringify({
  todos: [
    { text: "Read config", status: "done" },
    { text: "Write tests", status: "in_progress" },
  ],
});

describe("syncTodosFromToolCall", () => {
  it("sets the live list and records a per-call snapshot", () => {
    const dispatch = vi.fn();
    syncTodosFromToolCall("call-1", validArgs, dispatch);

    expect(dispatch).toHaveBeenCalledTimes(2);
    const [live, snapshot] = dispatch.mock.calls.map((c) => c[0]);

    const expected = [
      { id: "todo-1", text: "Read config", status: "done" },
      { id: "todo-2", text: "Write tests", status: "in_progress" },
    ];
    expect(live.type).toBe("session/setTodos");
    expect(live.payload).toEqual(expected);
    expect(snapshot.type).toBe("session/setTodosSnapshot");
    expect(snapshot.payload).toEqual({ toolCallId: "call-1", todos: expected });
  });

  it("ignores malformed JSON without dispatching", () => {
    const dispatch = vi.fn();
    syncTodosFromToolCall("call-1", "{not json", dispatch);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("ignores an invalid list (never partially applies)", () => {
    const dispatch = vi.fn();
    syncTodosFromToolCall(
      "call-1",
      JSON.stringify({
        todos: [
          { text: "a", status: "in_progress" },
          { text: "b", status: "in_progress" },
        ],
      }),
      dispatch,
    );
    expect(dispatch).not.toHaveBeenCalled();
  });
});
