import { ContextItem, ToolCallState, ToolStatus } from "core";
import { IHostBridge } from "../../context/HostBridge";
import { ChatHistoryItemWithMessageId } from "../slices/sessionSlice";
import { RootState } from "../store";

/**
 * Finds current tool calls with a specific status.
 *
 * @param chatHistory - The chat history array from Redux state
 * @param status - The tool call status to filter by
 * @returns Array of tool call states with the specified status
 */
export function findAllCurToolCallsByStatus(
  chatHistory: RootState["session"]["history"],
  status: ToolStatus,
): ToolCallState[] {
  return findAllCurToolCalls(chatHistory).filter(
    (toolCall) => toolCall.status === status,
  );
}

/**
 * Finds all current tool calls from the most recent assistant message with tool call states.
 *
 * @param chatHistory - The chat history array from Redux state
 * @returns An array of all current tool call states, or empty array if none found
 */
export function findAllCurToolCalls(
  chatHistory: RootState["session"]["history"],
): ToolCallState[] {
  // Find the most recent assistant message that has tool call states
  let seenAssistantMessage = false;
  let passedAssistantMessage = false;
  for (let i = chatHistory.length - 1; i >= 0; i--) {
    const item = chatHistory[i];
    if (item.message.role === "user") {
      return [];
    }
    if (item.message.role === "assistant" || item.message.role === "thinking") {
      seenAssistantMessage = true;
      if (item.toolCallStates && item.toolCallStates.length > 0) {
        return item.toolCallStates;
      }
    } else if (seenAssistantMessage) {
      passedAssistantMessage = true;
    }
    if (passedAssistantMessage) {
      return [];
    }
  }
  return [];
}

/**
 * Finds a specific tool call by its ID anywhere in the chat history.
 *
 * @param chatHistory - The chat history array from Redux state
 * @param toolCallId - The unique identifier of the tool call to find
 * @returns The tool call state with the matching ID, or undefined if not found
 */
export function findToolCallById(
  chatHistory: RootState["session"]["history"],
  toolCallId: string,
): ToolCallState | undefined {
  for (let i = chatHistory.length - 1; i >= 0; i--) {
    const item = chatHistory[i];
    if (item.toolCallStates) {
      const toolCallState = item.toolCallStates.find(
        (state) => state.toolCallId === toolCallId,
      );
      if (toolCallState) {
        return toolCallState;
      }
    }
  }

  return undefined;
}

export function findChatHistoryItemByToolCallId(
  chatHistory: RootState["session"]["history"],
  toolCallId: string,
): ChatHistoryItemWithMessageId | undefined {
  return chatHistory.findLast(
    (item) =>
      item.message.role === "tool" && item.message.toolCallId === toolCallId,
  );
}

export function logToolUsage(
  toolCallState: ToolCallState,
  accepted: boolean,
  success: boolean,
  messenger: IHostBridge,
  finalOutput?: ContextItem[],
) {}

const SERIAL_AGENT_TOOLS = new Set([
  "single_find_and_replace",
  "multi_edit",
  "edit_existing_file",
  "create_new_file",
  "run_terminal_command",
]);

let fileEditQueue: Promise<void> = Promise.resolve();
let deferredToolBatches = 0;

export function isSerialAgentTool(name: string | undefined): boolean {
  return !!name && SERIAL_AGENT_TOOLS.has(name);
}

export function beginDeferredToolBatch(): void {
  deferredToolBatches += 1;
}

export function endDeferredToolBatch(): void {
  deferredToolBatches = Math.max(0, deferredToolBatches - 1);
}

/** True while the agent driver is still inside a tool batch and will take the next turn itself. */
export function driverOwnsToolBatch(): boolean {
  return deferredToolBatches > 0;
}

export function enqueueFileEdit<T>(task: () => Promise<T>): Promise<T> {
  const run = fileEditQueue.then(task, task);
  fileEditQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

const FILE_EDIT_SETTLE_MS = 120_000;

export async function waitForFileEditToSettle(
  getState: () => RootState,
  toolCallId: string,
): Promise<void> {
  if (!getState().session?.history) {
    return;
  }
  const started = Date.now();
  while (Date.now() - started < FILE_EDIT_SETTLE_MS) {
    const tool = findToolCallById(getState().session.history, toolCallId);
    if (
      !tool ||
      tool.status === "done" ||
      tool.status === "errored" ||
      tool.status === "canceled"
    ) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error("Timed out waiting for the file edit to finish.");
}
