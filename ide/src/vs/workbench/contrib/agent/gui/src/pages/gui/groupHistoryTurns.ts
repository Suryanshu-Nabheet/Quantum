import { BuiltInToolNames } from "core/tools/builtIn";

export interface GroupableHistoryItem {
  message: {
    role: string;
    content?: unknown;
    redactedThinking?: string;
  };
  reasoning?: { text?: string; active?: boolean };
  toolCallStates?: {
    status?: string;
    toolCall: { function?: { name?: string } };
  }[];
}

export type HistoryTurn =
  | { kind: "user"; index: number }
  | { kind: "plain"; indexes: number[] }
  | {
      kind: "worked";
      workIndexes: number[];
      answerIndex: number | null;
      reasoningOnAnswer: boolean;
    };

function messageText(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((part) =>
      part && typeof part === "object" && "text" in part && typeof part.text === "string"
        ? part.text
        : "",
    )
    .join("")
    .trim();
}

function hasNonPlanTools(item: GroupableHistoryItem): boolean {
  return (item.toolCallStates ?? []).some(
    (call) => call.toolCall.function?.name !== BuiltInToolNames.CreatePlan,
  );
}

function isActivity(item: GroupableHistoryItem): boolean {
  if (item.message.role === "thinking") {
    return messageText(item.message.content).length > 0 || !!item.message.redactedThinking;
  }
  if (item.reasoning?.text) {
    return true;
  }
  return hasNonPlanTools(item);
}

function classify(history: GroupableHistoryItem[], indexes: number[]): HistoryTurn {
  if (!indexes.some((index) => isActivity(history[index]))) {
    return { kind: "plain", indexes };
  }

  const last = indexes[indexes.length - 1];
  const lastItem = history[last];
  const canBeAnswer =
    lastItem.message.role === "assistant" &&
    messageText(lastItem.message.content).length > 0 &&
    !hasNonPlanTools(lastItem);
  const answerIndex = canBeAnswer ? last : null;
  return {
    kind: "worked",
    workIndexes: indexes.filter((index) => index !== answerIndex),
    answerIndex,
    reasoningOnAnswer: answerIndex != null && !!history[answerIndex].reasoning?.text,
  };
}

export function groupHistoryTurns(history: GroupableHistoryItem[]): HistoryTurn[] {
  const turns: HistoryTurn[] = [];
  let index = 0;
  while (index < history.length) {
    const role = history[index].message.role;
    if (role === "system" || role === "tool") {
      index++;
      continue;
    }
    if (role === "user") {
      turns.push({ kind: "user", index });
      index++;
      continue;
    }

    const start = index;
    while (index < history.length) {
      const next = history[index].message.role;
      if (next === "user" || next === "system" || next === "tool") {
        break;
      }
      index++;
    }
    const indexes: number[] = [];
    for (let cursor = start; cursor < index; cursor++) {
      indexes.push(cursor);
    }
    turns.push(classify(history, indexes));
  }
  return turns;
}

const ACTIVE_TOOL = new Set(["generating", "calling", "generated"]);

export function turnIsWorking(
  history: GroupableHistoryItem[],
  workIndexes: number[],
  answerIndex: number | null,
  isStreaming: boolean,
): boolean {
  for (const index of workIndexes) {
    const item = history[index];
    if (!item) {
      continue;
    }
    if (item.reasoning?.active) {
      return true;
    }
    for (const call of item.toolCallStates ?? []) {
      if (call.toolCall.function?.name === BuiltInToolNames.CreatePlan) {
        continue;
      }
      if (call.status && ACTIVE_TOOL.has(call.status)) {
        return true;
      }
    }
  }
  if (answerIndex != null && history[answerIndex]?.reasoning?.active) {
    return true;
  }
  return isStreaming && answerIndex == null && workIndexes.includes(history.length - 1);
}
