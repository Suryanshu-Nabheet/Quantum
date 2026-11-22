import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  abortStream,
  cancelToolCall,
  clearDanglingMessages,
  setInactive,
} from "../slices/sessionSlice";
import { flushDebouncedSessionSave } from "../util/debouncedSessionSave";
import { ThunkApiType } from "../store";

export const cancelStream = createAsyncThunk<
  void,
  string | undefined,
  ThunkApiType
>(
  "chat/cancelStream",
  async (sessionId, { dispatch, getState, extra }) => {
    // A session switch aborts the previous stream. Its rejection can arrive
    // after the new transcript is loaded, so never clean up another session.
    if (sessionId && getState().session.id !== sessionId) {
      return;
    }

    dispatch(setInactive());
    dispatch(abortStream());
    for (const edit of getState().session.codeBlockApplyStates.states) {
      if (edit.toolCallId && edit.status !== "closed" && edit.status !== "review") {
        dispatch(cancelToolCall({ toolCallId: edit.toolCallId }));
        extra.hostBridge.post("rejectDiff", { streamId: edit.streamId });
      }
    }

    // Clear any dangling incomplete tool calls, thinking messages, etc.
    dispatch(clearDanglingMessages());
    await flushDebouncedSessionSave(dispatch, { generateTitle: false });
  },
);
