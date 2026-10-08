import { describe, expect, it } from "vitest";
import reducer, {
  closeSession,
  INITIAL_TABS_STATE,
  openSession,
  pruneSessions,
  setActiveSession,
} from "./tabsSlice";

describe("tabsSlice", () => {
  it("opening the same session twice keeps one tab", () => {
    let state = reducer(INITIAL_TABS_STATE, openSession("a"));
    state = reducer(state, openSession("a"));
    state = reducer(state, openSession("a"));
    expect(state.openSessionIds).toEqual(["a"]);
    expect(state.activeSessionId).toBe("a");
  });

  it("each distinct session adds exactly one tab", () => {
    let state = INITIAL_TABS_STATE;
    for (const id of ["a", "b", "c"]) {
      state = reducer(state, openSession(id));
    }
    expect(state.openSessionIds).toEqual(["a", "b", "c"]);
    expect(state.activeSessionId).toBe("c");
  });

  it("closing the active tab activates its neighbour", () => {
    let state = reducer(INITIAL_TABS_STATE, openSession("a"));
    state = reducer(state, openSession("b"));
    state = reducer(state, openSession("c"));
    state = reducer(state, closeSession("b"));
    expect(state.openSessionIds).toEqual(["a", "c"]);
    expect(state.activeSessionId).toBe("c");
  });

  it("closing an inactive tab leaves the active one alone", () => {
    let state = reducer(INITIAL_TABS_STATE, openSession("a"));
    state = reducer(state, openSession("b"));
    state = reducer(state, closeSession("a"));
    expect(state.openSessionIds).toEqual(["b"]);
    expect(state.activeSessionId).toBe("b");
  });

  it("prunes tabs whose session no longer exists", () => {
    let state = reducer(INITIAL_TABS_STATE, openSession("a"));
    state = reducer(state, openSession("b"));
    state = reducer(state, pruneSessions(["b"]));
    expect(state.openSessionIds).toEqual(["b"]);
    expect(state.activeSessionId).toBe("b");
  });

  it("ignores activating a session that is not open", () => {
    const state = reducer(
      reducer(INITIAL_TABS_STATE, openSession("a")),
      setActiveSession("zzz"),
    );
    expect(state.activeSessionId).toBe("a");
  });
});
