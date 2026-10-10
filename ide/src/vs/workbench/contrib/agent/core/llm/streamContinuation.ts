import { ChatMessage, PromptLog, ToolCall, ToolCallDelta } from "..";
import { renderChatMessage } from "../util/messageContent";

export const MAX_STREAM_CHAT_CONTINUATIONS = 8;

export const STREAM_CHAT_CONTINUATION_NUDGE =
  "Your previous response stopped before you finished. Continue exactly where you left off. If you said you would explore, read files, or use tools, do that now (call tools or write the analysis). Do not repeat work you already completed. If a tool call was incomplete, finish its JSON arguments and proceed.";

export function isTruncatedFinishReason(reason?: string | null): boolean {
  if (!reason) {
    return false;
  }
  const normalized = reason.toLowerCase();
  return (
    normalized === "length" ||
    normalized === "max_tokens" ||
    normalized === "model_length"
  );
}

function toToolCall(call: ToolCall | ToolCallDelta): ToolCall {
  return {
    id: call.id ?? "",
    type: call.type ?? "function",
    function: {
      name: call.function?.name ?? "",
      arguments: call.function?.arguments ?? "",
    },
  };
}

function mergeToolCallDelta(
  existing: ToolCall | undefined,
  delta: ToolCallDelta,
): ToolCall {
  const current = existing ?? {
    id: delta.id ?? "",
    type: delta.type ?? "function",
    function: { name: "", arguments: "" },
  };

  const nameDelta = delta.function?.name ?? "";
  const argsDelta = delta.function?.arguments ?? "";
  let mergedName = current.function.name ?? "";
  if (nameDelta.startsWith(mergedName)) {
    mergedName = nameDelta;
  } else if (!mergedName.startsWith(nameDelta)) {
    mergedName = mergedName + nameDelta;
  }

  let mergedArgs = current.function.arguments ?? "";
  try {
    JSON.parse(mergedArgs);
  } catch {
    mergedArgs = mergedArgs + argsDelta;
  }

  return {
    id: delta.id || current.id,
    type: delta.type ?? current.type,
    function: {
      name: mergedName,
      arguments: mergedArgs,
    },
  };
}

export function mergeAssistantStreamChunk(
  prior: ChatMessage | undefined,
  chunk: ChatMessage,
): ChatMessage {
  if (chunk.role !== "assistant") {
    return prior ?? chunk;
  }
  if (!prior || prior.role !== "assistant") {
    return chunk;
  }

  const priorText = renderChatMessage(prior);
  const chunkText = renderChatMessage(chunk);
  const content =
    priorText || chunkText ? `${priorText}${chunkText}` : prior.content;

  let toolCalls: ToolCall[] | undefined = prior.toolCalls
    ? prior.toolCalls.map(toToolCall)
    : undefined;
  if (chunk.toolCalls?.length) {
    toolCalls = toolCalls ?? [];
    for (const delta of chunk.toolCalls) {
      const idx = delta.id
        ? toolCalls.findIndex((t) => t.id === delta.id)
        : toolCalls.length - 1;
      if (idx >= 0 && toolCalls[idx]) {
        toolCalls[idx] = mergeToolCallDelta(toolCalls[idx], delta);
      } else {
        toolCalls.push(mergeToolCallDelta(undefined, delta));
      }
    }
  }

  return {
    ...prior,
    ...chunk,
    role: "assistant",
    content,
    toolCalls,
  };
}

export function resolveAssistantStreamText(
  promptLog: PromptLog,
  partialAssistant: ChatMessage | undefined,
): string {
  const fromPartial = partialAssistant
    ? renderChatMessage(partialAssistant)
    : "";
  const fromLog = promptLog.completion ?? "";
  return fromPartial.length >= fromLog.length ? fromPartial : fromLog;
}

/** Short preamble that promises action but never calls tools or delivers content. */
export function looksLikeDeferredAgentAction(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 600) {
    return false;
  }
  const sentenceCount = t.split(/(?<=[.!?])\s+/).filter((s) => s.trim()).length;
  if (sentenceCount > 3) {
    return false;
  }
  const promisesAction =
    /\b(let me|i'll|i will|i'm going to|now i'll|next,? i'll)\b/i.test(t);
  const actionVerb =
    /\b(explore|investigate|read|check|look at|analyze|search|list|inspect|dig|continue|open|run|scan|map|review|examine)\b/i.test(
      t,
    );
  return promisesAction && actionVerb;
}

/**
 * Detects assistant text that ended before the model actually answered
 * (common on small/free models: stops at "Here's my analysis:" with finish_reason stop).
 */
export function looksLikeIncompleteAssistantOutput(text: string): boolean {
  const t = text.trim();
  if (!t) {
    return true;
  }
  if (/:\s*$/.test(t)) {
    return true;
  }
  if (
    /\b(here('s| is)|following|below)\s+(my|the)\s+(analysis|summary|answer|response|breakdown)\s*:?\s*$/i.test(
      t,
    )
  ) {
    return true;
  }
  if (looksLikeDeferredAgentAction(t)) {
    return true;
  }
  const fences = t.match(/```/g);
  if (fences && fences.length % 2 === 1) {
    return true;
  }
  if (t.endsWith("...") || t.endsWith("…")) {
    return true;
  }
  return false;
}

export function shouldAutoContinueAgentDriverTurn(args: {
  mode: string;
  hasActiveTools: boolean;
  lastAssistantText: string;
  streamAborted: boolean;
  hasUnsettledToolWork: boolean;
}): boolean {
  if (args.streamAborted || args.hasUnsettledToolWork) {
    return false;
  }
  if (args.mode !== "agent" || !args.hasActiveTools) {
    return false;
  }
  return looksLikeIncompleteAssistantOutput(args.lastAssistantText);
}

export function assistantMessageHasIncompleteToolCalls(
  message: ChatMessage | undefined,
): boolean {
  if (!message || message.role !== "assistant" || !message.toolCalls?.length) {
    return false;
  }
  return message.toolCalls.some((tc) => {
    const name = tc.function?.name?.trim() ?? "";
    const args = tc.function?.arguments ?? "";
    if (!name) {
      return false;
    }
    if (!args.trim()) {
      return true;
    }
    try {
      JSON.parse(args);
      return false;
    } catch {
      return true;
    }
  });
}

export function shouldContinueLlmStream(
  promptLog: PromptLog,
  partialAssistant: ChatMessage | undefined,
): boolean {
  if (isTruncatedFinishReason(promptLog.finishReason)) {
    return true;
  }
  if (assistantMessageHasIncompleteToolCalls(partialAssistant)) {
    return true;
  }
  const hasSettledToolCalls =
    partialAssistant?.role === "assistant" &&
    !!partialAssistant.toolCalls?.length &&
    !assistantMessageHasIncompleteToolCalls(partialAssistant);
  if (hasSettledToolCalls) {
    return false;
  }
  const text = resolveAssistantStreamText(promptLog, partialAssistant);
  return looksLikeIncompleteAssistantOutput(text);
}

export function buildStreamContinuationMessages(
  baseMessages: ChatMessage[],
  partialAssistant: ChatMessage | undefined,
  promptLog: PromptLog,
): ChatMessage[] {
  const assistantMessage: ChatMessage =
    partialAssistant ??
    ({
      role: "assistant",
      content: promptLog.completion,
    } as ChatMessage);

  return [
    ...baseMessages,
    assistantMessage,
    {
      role: "user",
      content: STREAM_CHAT_CONTINUATION_NUDGE,
    },
  ];
}
