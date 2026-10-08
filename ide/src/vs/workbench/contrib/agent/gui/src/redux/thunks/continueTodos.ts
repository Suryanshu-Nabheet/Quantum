import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import {
  setAgentStepDepth,
  setInlineErrorMessage,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { streamNormalInput } from "./streamNormalInput";
import { streamThunkWrapper } from "./streamThunkWrapper";

/**
 * Resumes a paused long-running task. Only runs when the session still has
 * open todos, so it never starts an unrequested turn. Restarts the step budget
 * and continues from the existing history without adding a user message.
 */
export const continueTodos = createAsyncThunk<void, void, ThunkApiType>(
  "chat/continueTodos",
  async (_, { dispatch, getState }) => {
    const open = getState().session.todos.some((t) => t.status !== "done");
    if (!open) return;

    dispatch(setInlineErrorMessage(undefined));
    dispatch(setAgentStepDepth(0));
    // Same error policy as the user-send path: a failed continuation must
    // cancel the stream and clear dangling tool calls, not leave the agent stuck.
    unwrapResult(
      await dispatch(
        streamThunkWrapper(async () => {
          unwrapResult(await dispatch(streamNormalInput({ depth: 0 })));
        }),
      ),
    );
  },
);
