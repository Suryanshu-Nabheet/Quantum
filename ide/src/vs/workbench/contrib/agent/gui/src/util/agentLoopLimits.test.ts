import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_AGENT_STEPS,
  isAgentStepLimitReached,
  resolveMaxAgentSteps,
} from "./agentLoopLimits";

describe("agentLoopLimits", () => {
  it("uses default max steps when unset", () => {
    expect(resolveMaxAgentSteps(undefined)).toBe(DEFAULT_MAX_AGENT_STEPS);
    expect(resolveMaxAgentSteps({})).toBe(DEFAULT_MAX_AGENT_STEPS);
  });

  it("respects configured maxAgentSteps", () => {
    expect(resolveMaxAgentSteps({ maxAgentSteps: 1200 })).toBe(1200);
  });

  it("ignores invalid maxAgentSteps", () => {
    expect(resolveMaxAgentSteps({ maxAgentSteps: 0 })).toBe(
      DEFAULT_MAX_AGENT_STEPS,
    );
    expect(resolveMaxAgentSteps({ maxAgentSteps: NaN })).toBe(
      DEFAULT_MAX_AGENT_STEPS,
    );
  });

  it("detects limit in test env at TEST threshold", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "test";
    expect(isAgentStepLimitReached(49, undefined)).toBe(false);
    expect(isAgentStepLimitReached(50, undefined)).toBe(true);
    process.env.NODE_ENV = prev;
  });
});
