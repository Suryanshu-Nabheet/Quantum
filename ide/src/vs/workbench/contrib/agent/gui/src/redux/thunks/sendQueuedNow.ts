import { createAsyncThunk } from "@reduxjs/toolkit";
import { selectDoneApplyStates } from "../selectors/selectToolCalls";
import {
  removeQueuedMessage,
  resetTodosForNewRequest,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { cancelStream } from "./cancelStream";
import { waitForAgentDriver } from "./streamNormalInput";
import { streamResponseThunk } from "./streamResponse";

/** Stop the current turn if one is running, then send this queued message. */
export const sendQueuedNow = createAsyncThunk<void, string, ThunkApiType>(
  "chat/sendQueuedNow",
  async (queueId, { dispatch, extra, getState }) => {
    const item = (getState().session.messageQueue ?? []).find(
      (entry) => entry.id === queueId,
    );
    if (!item) {
      return;
    }

    if (getState().session.isStreaming) {
      for (const applyState of selectDoneApplyStates(getState())) {
        if (applyState.status === "done") {
          extra.ideMessenger.post("rejectDiff", applyState);
        }
      }
      await dispatch(cancelStream());
      await waitForAgentDriver();
    }

    const still = (getState().session.messageQueue ?? []).find(
      (entry) => entry.id === queueId,
    );
    if (!still || getState().session.isStreaming) {
      return;
    }

    dispatch(removeQueuedMessage(queueId));
    dispatch(resetTodosForNewRequest());
    await dispatch(
      streamResponseThunk({
        editorState: still.editorState,
        modifiers: { noContext: still.modifiers.noContext },
      }),
    );
  },
);
