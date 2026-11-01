import { describe, expect, it, vi } from "vitest";
import { Core } from "./core";

describe("Core.invoke", () => {
  it("preserves the caller message ID for targeted operations", () => {
    const invoke = vi.fn();
    const core = Object.create(Core.prototype) as Core;
    Object.defineProperty(core, "messenger", {
      value: { invoke },
    });

    core.invoke("abort", undefined, "stream-request-17");

    expect(invoke).toHaveBeenCalledWith(
      "abort",
      undefined,
      "stream-request-17",
    );
  });
});
