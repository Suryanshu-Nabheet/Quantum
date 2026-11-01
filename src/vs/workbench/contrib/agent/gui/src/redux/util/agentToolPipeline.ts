import { unwrapResult } from "@reduxjs/toolkit";
import { AppDispatch } from "../store";
import { callToolById } from "../thunks/callToolById";
import { streamResponseAfterToolCall } from "../thunks/streamResponseAfterToolCall";
import {
  beginDeferredToolBatch,
  endDeferredToolBatch,
  isSerialAgentTool,
} from "./index";

export type AgentToolCallRef = {
  toolCallId: string;
  name?: string;
};

export function toAgentToolCallRef(call: {
  toolCallId: string;
  toolCall: { function?: { name?: string } };
}): AgentToolCallRef {
  return {
    toolCallId: call.toolCallId,
    name: call.toolCall.function?.name,
  };
}

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
  toolCallIds: Array<string | AgentToolCallRef>,
  options: {
    depth: number;
    isAutoApproved: boolean;
    /** Append tool results without starting the next LLM stream per tool. */
    deferToolResults: boolean;
    /** Single LLM continuation after every tool in the batch finishes. */
    resumeAgent: boolean;
  },
): Promise<void> {
  const calls = toolCallIds.map((entry) =>
    typeof entry === "string" ? { toolCallId: entry } : entry,
  );
  if (calls.length === 0) {
    return;
  }

  const runOne = async (toolCallId: string) => {
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
  };

  beginDeferredToolBatch();
  try {
    const ordered = calls.some((call) => call.name);
    if (!ordered) {
      await Promise.all(calls.map((call) => runOne(call.toolCallId)));
    } else {
      let index = 0;
      while (index < calls.length) {
        if (isSerialAgentTool(calls[index].name)) {
          await runOne(calls[index].toolCallId);
          index += 1;
          continue;
        }
        const group: string[] = [];
        while (index < calls.length && !isSerialAgentTool(calls[index].name)) {
          group.push(calls[index].toolCallId);
          index += 1;
        }
        await Promise.all(group.map((toolCallId) => runOne(toolCallId)));
      }
    }
    if (options.resumeAgent) {
      await resumeAgentAfterParallelTools(
        dispatch,
        calls.map((call) => call.toolCallId),
        options.depth,
      );
    }
  } finally {
    endDeferredToolBatch();
  }
}
