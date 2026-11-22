import { ToolCallDelta, ToolCallState } from "core";
import { BuiltInToolNames, canonicalToolName } from "core/tools/builtIn";
import { incrementalParseJson } from "core/util/incrementalParseJson";

// Merge streamed tool calls
// See example of data coming in here:
// https://platform.openai.com/docs/guides/function-calling?api-mode=chat#streaming
export function addToolCallDeltaToState(
  toolCallDelta: ToolCallDelta,
  currentState: ToolCallState | undefined,
): ToolCallState {
  const currentCall = currentState?.toolCall;

  // If we have a current state and the delta has a different ID, ignore the delta
  if (
    currentState &&
    toolCallDelta.id &&
    currentCall?.id !== toolCallDelta.id
  ) {
    return currentState;
  }

  // These will/should not be partially streamed
  const callType = toolCallDelta.type ?? "function";
  const callId = currentCall?.id || toolCallDelta.id || "";

  // These may be streamed in chunks
  const currentName = currentCall?.function.name ?? "";
  const currentArgs = currentCall?.function.arguments ?? "";

  const nameDelta = toolCallDelta.function?.name ?? "";
  const argsDelta = toolCallDelta.function?.arguments ?? "";

  let mergedName = currentName;
  if (nameDelta.startsWith(currentName)) {
    // Case where model progresssively streams name but full name each time e.g. "readFi" -> "readFil" -> "readFile"
    mergedName = nameDelta;
  } else if (!currentName.startsWith(nameDelta)) {
    mergedName = currentName + nameDelta;
  }

  // Similar logic for args, with an extra JSON check
  let mergedArgs = currentArgs;
  if (argsDelta && currentArgs && argsDelta.startsWith(currentArgs)) {
    // Some providers send the accumulated argument string on each update.
    mergedArgs = argsDelta;
  } else if (currentArgs.trim() === "{}" && argsDelta.trim().startsWith("{")) {
    // Some providers send an empty placeholder before the actual arguments.
    mergedArgs = argsDelta;
  } else {
    try {
      // A completed argument object may be followed by duplicate deltas.
      JSON.parse(currentArgs);
    } catch {
      mergedArgs = currentArgs + argsDelta;
    }
  }

  const [_, parsedArgs] = incrementalParseJson(mergedArgs || "{}");

  // A late streamed chunk must not reset a call that has already settled
  // (e.g. errored by a policy evaluation). Only in-flight calls stay generating.
  const status =
    currentState && currentState.status !== "generating"
      ? currentState.status
      : "generating";

  return {
    status,
    output: currentState?.output,
    toolCall: {
      id: callId,
      type: callType,
      function: {
        name: canonicalToolName(mergedName),
        arguments: mergedArgs,
      },
    },
    toolCallId: callId,
    parsedArgs,
  };
}

const editToolNames: string[] = [
  BuiltInToolNames.EditExistingFile,
  BuiltInToolNames.SingleFindAndReplace,
  BuiltInToolNames.MultiEdit,
  BuiltInToolNames.CreateNewFile,
];
export function isEditTool(toolName: string) {
  return editToolNames.includes(toolName);
}
