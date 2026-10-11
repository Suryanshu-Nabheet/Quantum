import { ChatMessage, PromptLog, ToolCall, ToolCallDelta } from "..";
import { renderChatMessage } from "../util/messageContent";

export const MAX_STREAM_CHAT_CONTINUATIONS = 8;

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

export function userRequestedAutonomousCodebaseWork(userText: string): boolean {
  const u = userText.trim();
  if (!u) {
    return false;
  }
  return (
    /\b(analy[sz]e|audit|explore|review|scan|understand|map|fix|change|implement)\b.*\b(code\s*base|codebase|project|repo|repository|app)\b/i.test(
      u,
    ) ||
    /\b(code\s*base|codebase|project|repo|app)\b.*\b(analy[sz]e|audit|explore|review|scan|fix|change)\b/i.test(
      u,
    )
  );
}

/** Model told the user to run tools instead of calling them. */
export function looksLikePassiveAgentHandoff(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 1500) {
    return false;
  }
  const coachesUser =
    /\b(you can use|you'll need to|you need to specify|please specify|you should use|feel free to use)\b/i.test(
      t,
    );
  const mentionsTools =
    /\b(tool|tools|`ls`|ls tool|read_file|list_dir|grep|search)\b/i.test(t);
  return coachesUser && mentionsTools;
}

/** Codebase request answered with a short note and no findings. */
export function looksLikeStalledAutonomousTask(args: {
  lastUserText: string;
  lastAssistantText: string;
}): boolean {
  if (!userRequestedAutonomousCodebaseWork(args.lastUserText)) {
    return false;
  }
  const a = args.lastAssistantText.trim();
  if (!a || a.length > 600) {
    return false;
  }
  const hasDeliverable =
    /^#{1,3}\s/m.test(a) || /\n\n.{120,}/.test(a) || a.length > 400;
  return !hasDeliverable;
}

/** A finished sentence that only promises more work, with no tool call yet. */
export function looksLikeDeferredWork(text: string): boolean {
  const sentence = lastSentence(text);
  if (!sentence || sentence.length > 400 || sentence.includes("```")) {
    return false;
  }
  return /\b(let me|i'll|i will|i'm going to|im going to|next,? i|now i)\b[\s\S]{0,160}\b(dig|look|read|check|explore|scan|analy[sz]e|inspect|search|list|gather|continue|investigate|open|find|examine|understand)\b/i.test(
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
  "You stopped before using a tool. Call a tool in this turn. Do not write a status line and do not end with a colon.";

export const AGENT_FINISH_RESUME_NUDGE =
  "You stopped before the task was finished. Do not repeat the status line. If a file is still unread, call the tool now. If the tool results are already above, write the complete findings in full sentences and end the task.";

/**
 * Agent mode stopped on prose. Resume when the model handed the work back,
 * stalled a codebase request, promised more work, left todos open, or stopped
 * short after tools already ran. A finished answer to an ordinary question
 * does not resume.
 */
export function shouldResumeAgentAfterIdleReply(input: {
  text: string;
  lastUserText?: string;
  turnAlreadyUsedTools: boolean;
  hasOpenTodos: boolean;
}): boolean {
  if (
    userRequestedAutonomousCodebaseWork(input.lastUserText ?? "") &&
    !input.turnAlreadyUsedTools
  ) {
    return true;
  }
  if (looksLikePassiveAgentHandoff(input.text)) {
    return true;
  }
  if (
    looksLikeStalledAutonomousTask({
      lastUserText: input.lastUserText ?? "",
      lastAssistantText: input.text,
    })
  ) {
    return true;
  }
  if (!input.turnAlreadyUsedTools && !input.hasOpenTodos) {
    return (
      looksLikeDeferredWork(input.text) ||
      looksLikeIncompleteAssistantOutput(input.text)
    );
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
  const toolsAlreadyRan = messages.some((message) => message.role === "tool");
  return [
    ...messages,
    {
      role: "user",
      content: toolsAlreadyRan
        ? AGENT_FINISH_RESUME_NUDGE
        : AGENT_IDLE_RESUME_NUDGE,
    },
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

  const text = resolveAssistantStreamText(promptLog, partialAssistant);
  const content =
    looksLikeDeferredWork(text) || looksLikeIncompleteAssistantOutput(text)
      ? AGENT_IDLE_RESUME_NUDGE
      : STREAM_CHAT_CONTINUATION_NUDGE;
  return [
    ...baseMessages,
    assistantMessage,
    {
      role: "user",
      content,
    },
  ];
}
