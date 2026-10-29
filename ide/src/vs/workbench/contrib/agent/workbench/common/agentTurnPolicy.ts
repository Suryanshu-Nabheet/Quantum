import type {
  AgentUIConfig,
  ChatHistoryItem,
  TodoItem,
} from "../../core";
import { BuiltInToolNames } from "../../core/tools/builtIn";
import { BROWSER_TOOL_GROUP } from "../../core/tools/definitions/browserTools";
import { renderChatMessage } from "../../core/util/messageContent";
import {
  assistantReplyIsUnfinished,
  shouldResumeAgentAfterIdleReply,
  userRequestedAutonomousCodebaseWork,
} from "../../core/llm/streamContinuation";

/** Default cap for tool and model rounds in one user turn. */
export const DEFAULT_MAX_AGENT_STEPS = 500;

/** Keep automated stream fixtures bounded if a continuation regresses. */
export const TEST_MAX_AGENT_STEPS = 50;

export const AGENT_CONTINUATION_LIMITS = {
  idle: 4,
  unfinished: 8,
  failedTools: 4,
  unstarted: 8,
} as const;

export interface AgentContinuationCounts {
  readonly idle: number;
  readonly unfinished: number;
  readonly failedTools: number;
  readonly unstarted: number;
}

export type AgentContinuationReason =
  | "failedTools"
  | "unstarted"
  | "unfinished"
  | "idle"
  | undefined;

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

export function userTurnHasSuccessfulTool(
  history: readonly ChatHistoryItem[],
): boolean {
  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i];
    if (item.message.role === "user") {
      return false;
    }
    if (
      (item.toolCallStates ?? []).some(
        (call) =>
          call.status === "done" &&
          call.toolCall.function?.name !== BuiltInToolNames.CreatePlan,
      )
    ) {
      return true;
    }
  }
  return false;
}

export function userTurnAlreadyUsedTools(
  history: readonly ChatHistoryItem[],
): boolean {
  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i];
    if (item.message.role === "user") {
      return false;
    }
    if (
      (item.toolCallStates ?? []).some((call) => {
        const name = call.toolCall.function?.name;
        return !!name && name !== BuiltInToolNames.CreatePlan;
      })
    ) {
      return true;
    }
  }
  return false;
}

export function lastAssistantToolsAllErrored(
  history: readonly ChatHistoryItem[],
): boolean {
  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i];
    if (item.message.role === "user") {
      return false;
    }
    if (item.message.role !== "assistant") {
      continue;
    }
    const calls = item.toolCallStates ?? [];
    return calls.length > 0 && calls.every((call) => call.status === "errored");
  }
  return false;
}

export function lastAssistantText(history: readonly ChatHistoryItem[]): string {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].message.role === "assistant") {
      return renderChatMessage(history[i].message);
    }
    if (history[i].message.role === "user") {
      break;
    }
  }
  return "";
}

export function lastUserText(history: readonly ChatHistoryItem[]): string {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].message.role === "user") {
      return renderChatMessage(history[i].message);
    }
  }
  return "";
}

export function turnWantsBrowser(history: readonly ChatHistoryItem[]): boolean {
  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i];
    if (item.message.role !== "user") {
      continue;
    }
    const userText = renderChatMessage(item.message);
    if (/(?:\b(?:browser|webpage|localhost)\b|https?:\/\/)/i.test(userText)) {
      return true;
    }
    return (item.contextItems ?? []).some((entry) =>
      /browser/i.test(entry.id.providerTitle),
    );
  }
  return false;
}

export function agentStoppedBeforeFinishing(
  history: readonly ChatHistoryItem[],
  todos: readonly TodoItem[],
): boolean {
  return shouldResumeAgentAfterIdleReply({
    text: lastAssistantText(history),
    lastUserText: lastUserText(history),
    turnAlreadyUsedTools: userTurnAlreadyUsedTools(history),
    hasOpenTodos: todos.some((todo) => todo.status !== "done"),
  });
}

/** Chooses a bounded continuation reason for the current Agent turn. */
export function getAgentContinuationReason(
  history: readonly ChatHistoryItem[],
  todos: readonly TodoItem[],
  counts: AgentContinuationCounts,
): AgentContinuationReason {
  const failedTools = lastAssistantToolsAllErrored(history);
  if (failedTools && counts.failedTools < AGENT_CONTINUATION_LIMITS.failedTools) {
    return "failedTools";
  }

  if (
    !userTurnHasSuccessfulTool(history) &&
    userRequestedAutonomousCodebaseWork(lastUserText(history)) &&
    counts.unstarted < AGENT_CONTINUATION_LIMITS.unstarted
  ) {
    return "unstarted";
  }

  if (failedTools || !agentStoppedBeforeFinishing(history, todos)) {
    return undefined;
  }

  const unfinished = assistantReplyIsUnfinished(lastAssistantText(history));
  if (unfinished && counts.unfinished < AGENT_CONTINUATION_LIMITS.unfinished) {
    return "unfinished";
  }

  if (!unfinished && counts.idle < AGENT_CONTINUATION_LIMITS.idle) {
    return "idle";
  }

  return undefined;
}

export function filterToolsForTurn<T extends { group?: string }>(
  tools: T[],
  history: readonly ChatHistoryItem[],
): T[] {
  return turnWantsBrowser(history)
    ? tools
    : tools.filter((tool) => tool.group !== BROWSER_TOOL_GROUP);
}
