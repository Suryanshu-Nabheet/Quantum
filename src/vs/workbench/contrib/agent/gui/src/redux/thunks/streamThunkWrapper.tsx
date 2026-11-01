import { createAsyncThunk } from "@reduxjs/toolkit";
import StreamErrorDialog from "../../pages/gui/StreamError";
import { analyzeError } from "../../util/errorAnalysis";
import { selectSelectedChatModel } from "../slices/configSlice";
import { setDialogMessage, setShowDialog } from "../slices/uiSlice";
import { ThunkApiType } from "../store";
import { cancelStream } from "./cancelStream";
import {
  flushDebouncedSessionSave,
  scheduleDebouncedSessionSave,
} from "../util/debouncedSessionSave";
import {
  isOverloadedErrorMessage,
  OVERLOADED_RETRIES,
  overloadRetriesWereExhausted,
  overloadRetryDelayMs,
} from "../util/overloadRetry";

export const streamThunkWrapper = createAsyncThunk<
  void,
  () => Promise<void>,
  ThunkApiType
>("chat/streamWrapper", async (runStream, { dispatch, getState }) => {
  const streamSessionId = getState().session.id;

  for (let attempt = 0; attempt <= OVERLOADED_RETRIES; attempt++) {
    if (getState().session.id !== streamSessionId) {
      return;
    }

    try {
      await runStream();
      const state = getState();
      if (state.session.id !== streamSessionId) {
        return;
      }
      if (!state.session.isInEdit) {
        if (state.session.isStreaming) {
          scheduleDebouncedSessionSave(dispatch);
        } else {
          await flushDebouncedSessionSave(dispatch);
        }
      }
      return;
    } catch (e) {
      // Loading another chat aborts this stream. Ignore its late rejection;
      // canceling here would otherwise truncate the newly loaded transcript.
      if (getState().session.id !== streamSessionId) {
        return;
      }

      // Get the selected model from the state for error analysis
      const state = getState();
      const selectedModel = selectSelectedChatModel(state);
      const { message } = analyzeError(e, selectedModel);

      // A turn-level overload retry already ran in the agent driver. Re-running
      // the whole driver here would repeat completed turns, so surface it.
      const shouldRetry =
        isOverloadedErrorMessage(message) &&
        attempt < OVERLOADED_RETRIES &&
        !overloadRetriesWereExhausted(e);

      if (shouldRetry) {
        await dispatch(cancelStream(streamSessionId));
        if (getState().session.id !== streamSessionId) {
          return;
        }
        const delayMs = overloadRetryDelayMs(attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        await dispatch(cancelStream(streamSessionId));
        dispatch(setDialogMessage(<StreamErrorDialog error={e} />));
        dispatch(setShowDialog(true));
        return;
      }
    }
  }
});
