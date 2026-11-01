import { describe, expect, it } from "vitest";
import { getEmptyRootState } from "../../util/test/mockStore";
import { makeSelectPastContextItems } from "./selectPastContextItems";

const ctx = (id: string) => ({
  name: id,
  description: id,
  content: id,
  id: { providerTitle: "file", itemId: id },
  uri: { type: "file" as const, value: `/${id}.ts` },
});

function stateWith(history: any[]) {
  const state = getEmptyRootState();
  return { ...state, session: { ...state.session, history } } as any;
}

describe("makeSelectPastContextItems", () => {
  it("returns the same reference when a streamed tail item changes", () => {
    const first = { message: { id: "1", role: "user", content: "a" }, contextItems: [ctx("a")] };
    const second = { message: { id: "2", role: "assistant", content: "x" }, contextItems: [] };
    const select = makeSelectPastContextItems(0);

    const before = select(stateWith([first, second]));
    // Streaming replaces only the tail item; the prior item keeps identity.
    const streamed = { ...second, message: { id: "2", role: "assistant", content: "x more" } };
    const after = select(stateWith([first, streamed]));

    expect(after).toBe(before);
  });

  it("returns a new reference when a prior item's context changes", () => {
    const first = { message: { id: "1", role: "user", content: "a" }, contextItems: [ctx("a")] };
    const select = makeSelectPastContextItems(0);
    const before = select(stateWith([first]));
    const changed = { ...first, contextItems: [ctx("b")] };
    const after = select(stateWith([changed]));
    expect(after).not.toBe(before);
    expect(after[0].uri?.value).toBe("/b.ts");
  });

  it("returns an empty list for an undefined index", () => {
    const select = makeSelectPastContextItems(undefined);
    expect(select(stateWith([]))).toEqual([]);
  });
});
