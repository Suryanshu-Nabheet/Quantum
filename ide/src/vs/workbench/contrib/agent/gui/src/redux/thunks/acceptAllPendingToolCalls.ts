import { createAsyncThunk } from "@reduxjs/toolkit";
import { selectPendingToolCalls } from "../selectors/selectToolCalls";
import {
  runParallelToolCalls,
  toAgentToolCallRef,
} from "../util/agentToolPipeline";
import { ThunkApiType } from "../store";

export const acceptAllPendingToolCalls = createAsyncThunk<
  void,
  void,
  ThunkApiType
>("chat/acceptAllPendingToolCalls", async (_, { dispatch, getState }) => {
  const pending = selectPendingToolCalls(getState());
  if (pending.length === 0) {
    return;
  }
  const depth = getState().session.agentStepDepth + 1;
  await runParallelToolCalls(dispatch, pending.map((tc) => toAgentToolCallRef(tc)), {
    depth,
    isAutoApproved: false,
    deferToolResults: true,
    resumeAgent: true,
  });
});
