import { describe, expect, it } from "vitest";
import sessionReducer, {
  INITIAL_SESSION_STATE,
  newSession,
  setTodos,
} from "./sessionSlice";

const todo = (id: string, status: "pending" | "in_progress" | "done") => ({
  id,
  text: id,
  status,
});

describe("session todos state", () => {
  it("starts with an empty list", () => {
    expect(INITIAL_SESSION_STATE.todos).toEqual([]);
  });

  it("setTodos replaces the list", () => {
    let state = sessionReducer(
      INITIAL_SESSION_STATE,
      setTodos([todo("a", "pending")]),
    );
    state = sessionReducer(state, setTodos([todo("b", "done")]));
    expect(state.todos).toEqual([todo("b", "done")]);
  });

  it("a fresh session does not inherit the previous plan", () => {
    const withPlan = sessionReducer(
      INITIAL_SESSION_STATE,
      setTodos([todo("a", "in_progress")]),
    );
    const fresh = sessionReducer(withPlan, newSession(undefined));
    expect(fresh.todos).toEqual([]);
  });

  it("loading a session restores its saved todos", () => {
    const saved = {
      sessionId: "s1",
      title: "Saved",
      workspaceDirectory: "",
      history: [],
      todos: [todo("a", "done")],
    } as any;
    const state = sessionReducer(INITIAL_SESSION_STATE, newSession(saved));
    expect(state.todos).toEqual([todo("a", "done")]);
  });

  it("loading a legacy session without todos yields an empty list", () => {
    const legacy = {
      sessionId: "s2",
      title: "Old",
      workspaceDirectory: "",
      history: [],
    } as any;
    const state = sessionReducer(INITIAL_SESSION_STATE, newSession(legacy));
    expect(state.todos).toEqual([]);
  });
});
