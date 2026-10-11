import { Tool, ToolCallDelta } from "..";
import {
  createDelta,
  generateOpenAIToolCallId,
} from "./systemMessageTools/systemToolUtils";

type LooseToolJson = {
  name?: string;
  tool_name?: string;
  arguments?: unknown;
  parameters?: unknown;
  function?: { name?: string; arguments?: unknown };
};

function normalizeArguments(args: unknown): string | null {
  if (args === undefined || args === null) {
    return "{}";
  }
  if (typeof args === "string") {
    try {
      JSON.parse(args);
      return args;
    } catch {
      return null;
    }
  }
  if (typeof args === "object") {
    return JSON.stringify(args);
  }
  return null;
}

function resolveToolName(
  name: string,
  activeTools?: Tool[],
): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return null;
  }
  if (!activeTools?.length) {
    return trimmed;
  }
  const exact = activeTools.find((t) => t.function.name === trimmed);
  if (exact) {
    return exact.function.name;
  }
  const suffix = activeTools.find((t) =>
    t.function.name.toLowerCase().endsWith(trimmed.toLowerCase()),
  );
  return suffix?.function.name ?? trimmed;
}

export function extractMarkdownJsonToolPayload(text: string): string | null {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    return fence[1].trim();
  }
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }
  return null;
}

export function tryParseMarkdownJsonToolCall(
  text: string,
  activeTools?: Tool[],
): ToolCallDelta | null {
  const payload = extractMarkdownJsonToolPayload(text);
  if (!payload) {
    return null;
  }
  let obj: LooseToolJson;
  try {
    obj = JSON.parse(payload) as LooseToolJson;
  } catch {
    return null;
  }

  const rawName =
    obj.name ?? obj.tool_name ?? obj.function?.name ?? "";
  const name = resolveToolName(String(rawName), activeTools);
  if (!name) {
    return null;
  }

  const args = normalizeArguments(
    obj.arguments ?? obj.parameters ?? obj.function?.arguments,
  );
  if (!args) {
    return null;
  }

  return createDelta(name, args, generateOpenAIToolCallId());
}

export function stripMarkdownJsonToolCallFromAssistantText(text: string): string {
  return text
    .replace(/```(?:json)?\s*[\s\S]*?```/gi, "")
    .replace(/^\s*\{[\s\S]*"name"\s*:[\s\S]*\}\s*$/m, "")
    .trim();
}
