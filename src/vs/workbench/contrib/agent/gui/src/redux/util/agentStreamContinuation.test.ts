import { describe, expect, it } from "vitest";
import type { AppDispatch } from "../store";
import { ensureAgentTurnInactive } from "./agentStreamContinuation";

describe("ensureAgentTurnInactive", () => {
  it("dispatches setInactive when streaming", () => {
    const calls: string[] = [];
    const dispatch = (action: { type: string }) => {
      calls.push(action.type);
    };
    ensureAgentTurnInactive(dispatch as AppDispatch, () => ({
      session: { isStreaming: true },
    } as any));
    expect(calls).toContain("session/setInactive");
  });

  it("no-ops when already inactive", () => {
    const calls: string[] = [];
    ensureAgentTurnInactive((() => {}) as AppDispatch, () => ({
      session: { isStreaming: false },
    } as any));
    expect(calls).toHaveLength(0);
  });
});
