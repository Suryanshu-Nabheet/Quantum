import { createAsyncThunk } from "@reduxjs/toolkit";
import { selectPendingToolCalls } from "../selectors/selectToolCalls";
import { runParallelToolCalls } from "../util/agentToolPipeline";
import { ThunkApiType } from "../store";

export const acceptAllPendingToolCalls = createAsyncThunk<
  void,
  void,
  ThunkApiType
>("chat/acceptAllPendingToolCalls", async (_, { dispatch, getState }) => {
  const pending = selectPendingToolCalls(getState());
  const toolCallIds = pending.map((tc) => tc.toolCallId);
  if (toolCallIds.length === 0) {
    return;
  }
  const depth = getState().session.agentStepDepth + 1;
  await runParallelToolCalls(dispatch, toolCallIds, {
    depth,
    isAutoApproved: false,
    deferToolResults: true,
    resumeAgent: true,
  });
});
