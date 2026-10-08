import { describe, expect, it } from "vitest";
import TimelineItem from "./TimelineItem";

describe("TimelineItem memoization", () => {
  it("is exported as a React.memo component so rows can skip re-rendering", () => {
    // React.memo components carry $$typeof === Symbol.for("react.memo").
    // Without this wrapper, every parent render re-renders every timeline row.
    expect((TimelineItem as any).$$typeof).toBe(Symbol.for("react.memo"));
  });
});
