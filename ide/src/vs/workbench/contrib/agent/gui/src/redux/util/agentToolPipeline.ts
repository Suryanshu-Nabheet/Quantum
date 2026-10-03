import { unwrapResult } from "@reduxjs/toolkit";
import { AppDispatch } from "../store";
import { callToolById } from "../thunks/callToolById";
import { streamResponseAfterToolCall } from "../thunks/streamResponseAfterToolCall";

/** One LLM continuation after parallel tools finish (avoids concurrent streams). */
export async function resumeAgentAfterParallelTools(
  dispatch: AppDispatch,
  toolCallIds: string[],
  depth: number,
): Promise<void> {
  const lastToolCallId = toolCallIds[toolCallIds.length - 1];
  if (!lastToolCallId) {
    return;
  }
  unwrapResult(
    await dispatch(
      streamResponseAfterToolCall({
        toolCallId: lastToolCallId,
        depth,
        skipToolMessage: true,
      }),
    ),
  );
}

export async function runParallelToolCalls(
  dispatch: AppDispatch,
  toolCallIds: string[],
  options: {
    depth: number;
    isAutoApproved: boolean;
    /** Append tool results without starting the next LLM stream per tool. */
    deferToolResults: boolean;
    /** Single LLM continuation after every tool in the batch finishes. */
    resumeAgent: boolean;
  },
): Promise<void> {
  if (toolCallIds.length === 0) {
    return;
  }
  await Promise.all(
    toolCallIds.map(async (toolCallId) => {
      unwrapResult(
        await dispatch(
          callToolById({
            toolCallId,
            isAutoApproved: options.isAutoApproved,
            depth: options.depth,
            deferAgentContinuation: options.deferToolResults,
          }),
        ),
      );
    }),
  );
  if (options.resumeAgent) {
    await resumeAgentAfterParallelTools(
      dispatch,
      toolCallIds,
      options.depth,
    );
  }
}
