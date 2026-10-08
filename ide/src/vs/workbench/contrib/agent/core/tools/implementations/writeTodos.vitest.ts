import { describe, expect, it } from "vitest";
import { normalizeTodos, summarizeTodos } from "./writeTodos";

describe("normalizeTodos", () => {
  it("assigns stable ids and trims text", () => {
    const items = normalizeTodos([
      { text: "  Read config  ", status: "done" },
      { text: "Write tests", status: "in_progress" },
    ]);
    expect(items).toEqual([
      { id: "todo-1", text: "Read config", status: "done" },
      { id: "todo-2", text: "Write tests", status: "in_progress" },
    ]);
  });

  it("rejects a non-array payload", () => {
    expect(() => normalizeTodos("nope")).toThrow(/must be an array/);
  });

  it("rejects an empty text", () => {
    expect(() => normalizeTodos([{ text: "   ", status: "pending" }])).toThrow(
      /non-empty/,
    );
  });

  it("rejects an unknown status", () => {
    expect(() =>
      normalizeTodos([{ text: "x", status: "started" }]),
    ).toThrow(/status must be one of/);
  });

  it("allows at most one in_progress item", () => {
    expect(() =>
      normalizeTodos([
        { text: "a", status: "in_progress" },
        { text: "b", status: "in_progress" },
      ]),
    ).toThrow(/only one todo may be in_progress/);
  });

  it("accepts an empty list (clears the plan)", () => {
    expect(normalizeTodos([])).toEqual([]);
  });
});

describe("summarizeTodos", () => {
  it("reports progress and marks each status", () => {
    const summary = summarizeTodos([
      { id: "1", text: "Read", status: "done" },
      { id: "2", text: "Edit", status: "in_progress" },
      { id: "3", text: "Test", status: "pending" },
    ]);
    expect(summary).toBe(
      "Todos 1/3 done:\n[x] Read\n[~] Edit\n[ ] Test",
    );
  });
});
