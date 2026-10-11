import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  abortStream,
  clearDanglingMessages,
  clearTodos,
  setInactive,
} from "../slices/sessionSlice";
import { flushDebouncedSessionSave } from "../util/debouncedSessionSave";
import { ThunkApiType } from "../store";

export const cancelStream = createAsyncThunk<void, undefined, ThunkApiType>(
  "chat/cancelStream",
  async (messages, { dispatch, extra, getState }) => {
    dispatch(setInactive());
    dispatch(abortStream());
    // Stop ends the task. Open todos must not stay in the session and
    // get injected into every later turn.
    dispatch(clearTodos());

    // Clear any dangling incomplete tool calls, thinking messages, etc.
    dispatch(clearDanglingMessages());
    flushDebouncedSessionSave(dispatch);
  },
);
