import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { selectCurrentToolCalls } from "../selectors/selectToolCalls";
import {
  ChatHistoryItemWithMessageId,
  resetNextCodeBlockToApplyIndex,
  setActive,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { streamNormalInput } from "./streamNormalInput";
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

export const streamResponseAfterToolCall = createAsyncThunk<
  void,
  { toolCallId: string; depth?: number; skipToolMessage?: boolean },
  ThunkApiType
>(
  "chat/streamAfterToolCall",
  async ({ toolCallId, depth = 0, skipToolMessage = false }, { dispatch, getState }) => {
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

        const history = getState().session.history;
        const assistantMessage = history.findLast(
          (item) =>
            item.message.role === "assistant" &&
            item.toolCallStates?.some((tc) => tc.toolCallId === toolCallId),
        );

        if (
          !assistantMessage ||
          !areAllToolsDoneStreaming(
            assistantMessage,
            getState().config.config.ui?.resumeAfterToolRejection,
          )
        ) {
          return;
        }

        if (!getState().session.isStreaming) {
          dispatch(setActive());
        }

        unwrapResult(await dispatch(streamNormalInput({ depth: depth + 1 })));
      }),
    );
  },
);
