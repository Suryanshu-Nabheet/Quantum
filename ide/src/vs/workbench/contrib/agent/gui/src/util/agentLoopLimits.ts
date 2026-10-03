import { AgentUIConfig } from "core";

/** Default cap for tool/LLM rounds in one user turn (long-horizon agent work). */
export const DEFAULT_MAX_AGENT_STEPS = 500;

/** Vitest guard — keeps streamResponse tests from infinite recursion. */
export const TEST_MAX_AGENT_STEPS = 50;

export function resolveMaxAgentSteps(ui: AgentUIConfig | undefined): number {
  const configured = ui?.maxAgentSteps;
  if (
    typeof configured === "number" &&
    Number.isFinite(configured) &&
    configured >= 1
  ) {
    return Math.floor(configured);
  }
  return DEFAULT_MAX_AGENT_STEPS;
}

export function isAgentStepLimitReached(
  depth: number,
  ui: AgentUIConfig | undefined,
): boolean {
  const maxSteps =
    process.env.NODE_ENV === "test"
      ? TEST_MAX_AGENT_STEPS
      : resolveMaxAgentSteps(ui);
  return depth >= maxSteps;
}

export function agentStepLimitMessage(maxSteps: number): string {
  return `Agent reached the step limit (${maxSteps} tool/LLM rounds). Send another message to continue, or raise maxAgentSteps in Settings.`;
}
