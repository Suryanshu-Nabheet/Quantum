import { ChatMessage, PromptLog, ToolCall, ToolCallDelta } from "..";
import { renderChatMessage } from "../util/messageContent";

export const MAX_STREAM_CHAT_CONTINUATIONS = 6;

export const STREAM_CHAT_CONTINUATION_NUDGE =
  "Your previous response stopped before you finished. Continue in a new paragraph. If you said you would explore, read files, or use tools, do that now. If you already have the files, write the findings in complete sentences. Do not repeat the lead-in, and do not end with a colon.";

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
    priorText || chunkText
      ? appendStreamedAssistantText(priorText, chunkText)
      : prior.content;

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

/**
 * Detects assistant text that ended before the model actually answered
 * (common on small/free models: stops at "Here's my analysis:" with finish_reason stop).
 */
function lastSentence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/[^.!?\n]+[.!?]?$/);
  return (match?.[0] ?? trimmed).trim();
}

/**
 * Join two streamed pieces. A new sentence that starts immediately after
 * punctuation is a continuation boundary, not the next token.
 */
export function appendStreamedAssistantText(prior: string, next: string): string {
  if (!prior) {
    return next;
  }
  if (!next) {
    return prior;
  }
  if (/\s$/.test(prior) || /^\s/.test(next)) {
    return prior + next;
  }
  if (/[:.!?]$/.test(prior) && /^[A-Za-z"'`(]/.test(next)) {
    return `${prior}\n\n${next}`;
  }
  return prior + next;
}

/** A finished sentence that only promises more work, with no tool call yet. */
export function looksLikeDeferredWork(text: string): boolean {
  const sentence = lastSentence(text);
  if (!sentence || sentence.length > 400 || sentence.includes("```")) {
    return false;
  }
  return /\b(let me|i'll|i will|i'm going to|im going to|next,? i|now i)\b[\s\S]{0,160}\b(dig|look|read|check|explore|scan|analy[sz]e|inspect|search|list|gather|continue|investigate|open|find)\b/i.test(
    sentence,
  );
}

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
  const fences = t.match(/```/g);
  if (fences && fences.length % 2 === 1) {
    return true;
  }
  if (t.endsWith("...") || t.endsWith("…")) {
    return true;
  }
  return false;
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

/** Reply shorter than this, after tools already ran, is a mid-task stop. */
const IDLE_REPLY_MAX_CHARS = 500;

/** Empty, a promise to keep working, or a lead-in with no findings after it. */
export function assistantReplyIsUnfinished(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return true;
  }
  return (
    looksLikeDeferredWork(trimmed) ||
    looksLikeIncompleteAssistantOutput(trimmed)
  );
}

export const AGENT_IDLE_RESUME_NUDGE =
  "You stopped before the task was finished. Do not repeat the status line and do not end with a colon. If files still need reading, call the tools now. If you already have them, write the findings in complete sentences.";

/**
 * Agent mode stopped on prose. Resume when todos are still open, or this user
 * turn already used tools and the reply is unfinished or only a short note.
 * A first reply with no tools and no todos is a real answer and must not resume.
 */
export function shouldResumeAgentAfterIdleReply(input: {
  text: string;
  turnAlreadyUsedTools: boolean;
  hasOpenTodos: boolean;
}): boolean {
  if (!input.turnAlreadyUsedTools && !input.hasOpenTodos) {
    return false;
  }
  if (input.hasOpenTodos) {
    return true;
  }
  const trimmed = input.text.trim();
  if (!trimmed) {
    return true;
  }
  if (
    looksLikeDeferredWork(trimmed) ||
    looksLikeIncompleteAssistantOutput(trimmed)
  ) {
    return true;
  }
  return trimmed.length < IDLE_REPLY_MAX_CHARS;
}

/** Request-only nudge. Not written into chat history, so it does not split the turn. */
export function withAgentIdleResumeNudge(
  messages: ChatMessage[],
): ChatMessage[] {
  const last = messages[messages.length - 1];
  if (!last || last.role !== "assistant" || last.toolCalls?.length) {
    return messages;
  }
  return [
    ...messages,
    { role: "user", content: AGENT_IDLE_RESUME_NUDGE },
  ];
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
  if (looksLikeDeferredWork(text)) {
    return true;
  }
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
