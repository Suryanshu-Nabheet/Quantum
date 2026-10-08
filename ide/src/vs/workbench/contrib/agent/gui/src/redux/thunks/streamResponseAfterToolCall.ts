import { createAsyncThunk } from "@reduxjs/toolkit";
import { selectCurrentToolCalls } from "../selectors/selectToolCalls";
import { findAllCurToolCalls } from "../util";
import {
  ChatHistoryItemWithMessageId,
  resetNextCodeBlockToApplyIndex,
  setActive,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { runAgentDriver } from "./streamNormalInput";
import { streamThunkWrapper } from "./streamThunkWrapper";
import { appendToolResultMessage } from "../util/toolResultMessages";

/**
 * Determines if we should resume streaming based on tool call completion status.
 */
function areAllToolsDoneStreaming(
  assistantMessage: ChatHistoryItemWithMessageId,
  resumeAfterToolRejection: boolean | undefined,
): boolean {
  // This might occur because of race conditions, if so, the tools are completed
  if (!assistantMessage.toolCallStates) {
    return true;
  }

  // Only resume if all tool calls are complete
  const completedToolCalls = assistantMessage.toolCallStates.filter(
    (tc) =>
      tc.status === "done" ||
      tc.status === "errored" ||
      (resumeAfterToolRejection && tc.status === "canceled"),
  );

  return completedToolCalls.length === assistantMessage.toolCallStates.length;
}

/**
 * Finalization gate shared by the loop and the external resume thunk: the
 * agent may take its next LLM turn only once every tool call on the assistant
 * message that produced `toolCallId` has settled.
 */
export function canResumeAfterToolCall(
  history: ChatHistoryItemWithMessageId[],
  toolCallId: string,
  resumeAfterToolRejection: boolean | undefined,
): boolean {
  // Mirror the resume thunk: the anchor must belong to the current tool calls
  // (the most recent assistant message with tool call states), not an older one.
  if (!findAllCurToolCalls(history).some((tc) => tc.toolCallId === toolCallId)) {
    return false;
  }
  const assistantMessage = history.findLast(
    (item) =>
      item.message.role === "assistant" &&
      item.toolCallStates?.some((tc) => tc.toolCallId === toolCallId),
  );
  return (
    !!assistantMessage &&
    areAllToolsDoneStreaming(assistantMessage, resumeAfterToolRejection)
  );
}

export const streamResponseAfterToolCall = createAsyncThunk<
  void,
  { toolCallId: string; depth?: number; skipToolMessage?: boolean },
  ThunkApiType
>(
  "chat/streamAfterToolCall",
  async (
    { toolCallId, depth = 0, skipToolMessage = false },
    { dispatch, extra, getState },
  ) => {
    await dispatch(
      streamThunkWrapper(async () => {
        const state = getState();
        const currentToolCalls = selectCurrentToolCalls(state);
        const toolCallState = currentToolCalls.find(
          (tc) => tc.toolCallId === toolCallId,
        );

        if (!toolCallState) {
          return;
        }

        dispatch(resetNextCodeBlockToApplyIndex());

        if (!skipToolMessage) {
          appendToolResultMessage(
            dispatch,
            getState().session.history,
            toolCallId,
          );
        }

        if (
          !canResumeAfterToolCall(
            getState().session.history,
            toolCallId,
            getState().config.config.ui?.resumeAfterToolRejection,
          )
        ) {
          return;
        }

        if (!getState().session.isStreaming) {
          dispatch(setActive());
        }

        // The driver serializes each LLM stream through the stream lock itself.
        // Do not wrap the driver in the lock here: the lock is not reentrant and
        // the driver would wait on the lock this call already holds.
        await runAgentDriver({
          depth: depth + 1,
          dispatch,
          extra,
          getState,
        });
      }),
    );
  },
);
