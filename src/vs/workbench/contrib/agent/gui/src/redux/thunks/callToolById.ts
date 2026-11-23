import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { ContextItem, McpUiState } from "core";
import { BuiltInToolNames, CLIENT_TOOLS_IMPLS } from "core/tools/builtIn";
import { getStringArg } from "core/tools/parseArgs";
import { AgentError, AgentErrorReason } from "core/util/errors";
import { callClientTool } from "../../util/clientTools/callClientTool";
import { selectSelectedChatModel } from "../slices/configSlice";
import {
  acceptToolCall,
  errorToolCall,
  setInactive,
  setToolCallCalling,
  updateToolCallOutput,
  updateApplyState,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { findToolCallById, logToolUsage } from "../util";
import { syncTodosFromToolCall } from "../util/syncTodos";
import { appendToolResultMessage } from "../util/toolResultMessages";
import { streamResponseAfterToolCall } from "./streamResponseAfterToolCall";
import { scheduleDebouncedSessionSave } from "../util/debouncedSessionSave";

export const callToolById = createAsyncThunk<
  void,
  {
    toolCallId: string;
    isAutoApproved?: boolean;
    depth?: number;
    deferAgentContinuation?: boolean;
  },
  ThunkApiType
>("chat/callTool", async (inputs, { dispatch, extra, getState }) => {
  const {
    toolCallId,
    isAutoApproved,
    deferAgentContinuation,
  } = inputs;
  const depth =
    inputs.depth !== undefined
      ? inputs.depth
      : getState().session.agentStepDepth + 1;

  const state = getState();
  const toolCallState = findToolCallById(state.session.history, toolCallId);
  if (!toolCallState) {
    console.warn(`Tool call with ID ${toolCallId} not found`);
    return;
  }

  if (toolCallState.status !== "generated") {
    return;
  }

  const selectedChatModel = selectSelectedChatModel(state);

  dispatch(
    setToolCallCalling({
      toolCallId,
    }),
  );

  let output: ContextItem[] | undefined = undefined;
  let mcpUiState: McpUiState | undefined = undefined;
  let error: AgentError | undefined;
  let streamResponse = !!selectedChatModel;

  // Tool execution and host-bridge failures become tool results so the agent
  // can explain the failure or choose a safe retry instead of stranding the
  // call in its in-progress state.
  try {
    if (!selectedChatModel) {
      throw new Error("No model selected");
    }

    if (
      CLIENT_TOOLS_IMPLS.includes(
        toolCallState.toolCall.function.name as
          (typeof CLIENT_TOOLS_IMPLS)[number],
      )
    ) {
      // Tool is called on client side
      const {
        output: clientToolOutput,
        respondImmediately,
        error: clientToolError,
      } = await callClientTool(toolCallState, {
        dispatch,
        hostBridge: extra.hostBridge,
        getState,
      });
      output = clientToolOutput;
      error = clientToolError;
      streamResponse = respondImmediately;
    } else {
      // Tool is called on core side
      const result = await extra.hostBridge.request("tools/call", {
        toolCall: toolCallState.toolCall,
      });
      if (result.status === "error") {
        throw new Error(result.error);
      }
      output = result.content.contextItems;
      mcpUiState = result.content.mcpUiState;
      error = result.content.errorMessage
        ? new AgentError(
            result.content.errorReason || AgentErrorReason.Unspecified,
            result.content.errorMessage,
          )
        : undefined;
      streamResponse = true;
    }
  } catch (caughtError) {
    error =
      caughtError instanceof AgentError
        ? caughtError
        : new AgentError(
            caughtError instanceof Error
              ? AgentErrorReason.Unspecified
              : AgentErrorReason.Unknown,
            caughtError instanceof Error
              ? caughtError.message
              : String(caughtError),
          );
  }

  // A user can cancel a running tool while its host request is pending. Keep
  // that terminal state and do not resume the agent after cancellation.
  const currentToolCall = findToolCallById(
    getState().session.history,
    toolCallId,
  );
  if (!currentToolCall || currentToolCall.status !== "calling") {
    return;
  }

  if (!error && toolCallState.toolCall.function.name === BuiltInToolNames.CreateNewFile) {
    const filepath = output?.find((item) => item.uri?.type === "file")?.uri?.value;
    const contents = getStringArg(toolCallState.parsedArgs, "contents", true);
    if (filepath) {
      dispatch(updateApplyState({
        streamId: toolCallId,
        toolCallId,
        filepath,
        status: "review",
        originalFileContent: "",
        fileContent: contents,
        createdFile: true,
      }));
      scheduleDebouncedSessionSave(dispatch);
    }
  }

  if (error) {
    dispatch(
      updateToolCallOutput({
        toolCallId,
        contextItems: [
          {
            icon: "problems",
            name: "Tool Call Error",
            description: "Tool Call Failed",
            content: `${toolCallState.toolCall.function.name} failed with the message: ${error.message}\n\nPlease try something else or request further instructions.`,
            hidden: false,
          },
        ],
      }),
    );
  } else if (output?.length) {
    dispatch(
      updateToolCallOutput({
        toolCallId,
        contextItems: output,
        mcpUiState,
      }),
    );
  }

  if (
    !error &&
    toolCallState.toolCall.function.name === "write_todos" &&
    getState().session.isStreaming
  ) {
    syncTodosFromToolCall(
      toolCallId,
      toolCallState.toolCall.function.arguments,
      dispatch,
    );
  }

  if (error) {
    logToolUsage(toolCallState, false, false, extra.hostBridge, output);
    dispatch(errorToolCall({ toolCallId }));
  } else if (streamResponse) {
    logToolUsage(toolCallState, true, true, extra.hostBridge, output);
    dispatch(acceptToolCall({ toolCallId }));
  }

  if (streamResponse) {
    // Send to the LLM to resume the conversation (once all parallel tools finish).
    if (deferAgentContinuation) {
      appendToolResultMessage(
        dispatch,
        getState().session.history,
        toolCallId,
      );
    } else {
      const wrapped = await dispatch(
        streamResponseAfterToolCall({
          toolCallId,
          depth,
        }),
      );
      unwrapResult(wrapped);
    }
  } else if (!deferAgentContinuation) {
    dispatch(setInactive());
  }
});
