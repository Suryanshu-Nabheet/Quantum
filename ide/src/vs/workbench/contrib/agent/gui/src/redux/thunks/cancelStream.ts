import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  abortStream,
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
  async (sessionId, { dispatch, getState }) => {
    // A session switch aborts the previous stream. Its rejection can arrive
    // after the new transcript is loaded, so never clean up another session.
    if (sessionId && getState().session.id !== sessionId) {
      return;
    }

    dispatch(setInactive());
    dispatch(abortStream());

    // Clear any dangling incomplete tool calls, thinking messages, etc.
    dispatch(clearDanglingMessages());
    await flushDebouncedSessionSave(dispatch, { generateTitle: false });
  },
);
