import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { ChatMessage, LLMFullCompletionOptions, ModelDescription } from "core";
import { ToCoreProtocol } from "core/protocol";
import { selectActiveTools } from "../selectors/selectActiveTools";
import { selectSelectedChatModel } from "../slices/configSlice";
import {
  addPromptCompletionPair,
  errorToolCall,
  setActive,
  setAgentStepDepth,
  setAppliedRulesAtIndex,
  setContextPercentage,
  setInactive,
  setInlineErrorMessage,
  setIsPruned,
  setToolGenerated,
} from "../slices/sessionSlice";
import { ThunkApiType, AppDispatch, RootState } from "../store";
import { constructMessages } from "../util/constructMessages";

import { modelSupportsNativeTools } from "core/llm/toolSupport";
import { applyToolOverrides } from "core/tools/applyToolOverrides";
import { addSystemMessageToolsToSystemMessage } from "core/tools/systemMessageTools/buildToolsSystemMessage";
import { interceptSystemToolCalls } from "core/tools/systemMessageTools/interceptSystemToolCalls";
import { SystemMessageToolCodeblocksFramework } from "core/tools/systemMessageTools/toolCodeblocks";
import {
  selectCurrentToolCalls,
  selectPendingToolCalls,
} from "../selectors/selectToolCalls";
import { getBaseSystemMessage } from "../util/getBaseSystemMessage";
import { evaluateToolPolicies } from "./evaluateToolPolicies";
import { preprocessToolCalls } from "./preprocessToolCallArgs";
import { streamResponseAfterToolCall } from "./streamResponseAfterToolCall";
import {
  agentStepLimitMessage,
  isAgentStepLimitReached,
  resolveMaxAgentSteps,
} from "../../util/agentLoopLimits";
import { createStreamRenderBatcher } from "../util/streamRenderBatch";
import { withAgentStreamLock } from "../util/agentStreamLock";
import { runParallelToolCalls } from "../util/agentToolPipeline";

/**
 * Builds completion options with reasoning configuration based on session state and model capabilities.
 *
 * @param baseOptions - Base completion options to extend
 * @param hasReasoningEnabled - Whether reasoning is enabled in the session
 * @param model - The selected model with provider and completion options
 * @returns Completion options with reasoning configuration
 */
function buildReasoningCompletionOptions(
  baseOptions: LLMFullCompletionOptions,
  hasReasoningEnabled: boolean | undefined,
  model: ModelDescription,
): LLMFullCompletionOptions {
  if (hasReasoningEnabled === undefined) {
    return baseOptions;
  }

  const reasoningOptions: LLMFullCompletionOptions = {
    ...baseOptions,
    reasoning: !!hasReasoningEnabled,
  };

  // Add reasoning budget tokens if reasoning is enabled and provider supports it
  if (hasReasoningEnabled && model.underlyingProviderName !== "ollama") {
    // Ollama doesn't support limiting reasoning tokens at this point
    reasoningOptions.reasoningBudgetTokens =
      model.completionOptions?.reasoningBudgetTokens ?? 2048;
  }

  return reasoningOptions;
}

export const streamNormalInput = createAsyncThunk<
  void,
  {
    legacySlashCommandData?: ToCoreProtocol["llm/streamChat"][0]["legacySlashCommandData"];
    depth?: number;
  },
  ThunkApiType
>(
  "chat/streamNormalInput",
  async (
    { legacySlashCommandData, depth = 0 },
    { dispatch, extra, getState },
  ) => {
    const state = getState();
    if (isAgentStepLimitReached(depth, state.config.config.ui)) {
      const maxSteps = resolveMaxAgentSteps(state.config.config.ui);
      const message = agentStepLimitMessage(maxSteps);
      if (process.env.NODE_ENV === "test") {
        console.error(message, JSON.stringify(getState(), null, 2));
        throw new Error(message);
      }
      dispatch(setInlineErrorMessage("max-agent-steps"));
      dispatch(setInactive());
      return;
    }
    dispatch(setAgentStepDepth(depth));
    const selectedChatModel = selectSelectedChatModel(state);

    if (!selectedChatModel) {
      throw new Error("No chat model selected");
    }

    await withAgentStreamLock(async () => {
      await runStreamNormalInputLocked({
        legacySlashCommandData,
        depth,
        dispatch,
        extra,
        getState,
        selectedChatModel,
      });
    });
  },
);

async function runStreamNormalInputLocked({
  legacySlashCommandData,
  depth,
  dispatch,
  extra,
  getState,
  selectedChatModel,
}: {
  legacySlashCommandData?: ToCoreProtocol["llm/streamChat"][0]["legacySlashCommandData"];
  depth: number;
  dispatch: AppDispatch;
  extra: ThunkApiType["extra"];
  getState: () => RootState;
  selectedChatModel: ModelDescription;
}) {
  const state = getState();
  let activeTools = selectActiveTools(state);
  if (selectedChatModel.toolOverrides?.length) {
    const { tools: overriddenTools, errors } = applyToolOverrides(
      activeTools,
      selectedChatModel.toolOverrides,
    );
    activeTools = overriddenTools;
    for (const error of errors) {
      if (!error.fatal) {
        console.warn(`Tool override warning: ${error.message}`);
      }
    }
  }

  const useNativeTools = state.config.config.experimental
      ?.onlyUseSystemMessageTools
      ? false
      : modelSupportsNativeTools(selectedChatModel);
  const systemToolsFramework = !useNativeTools
    ? new SystemMessageToolCodeblocksFramework()
    : undefined;

  // Construct completion options
  let completionOptions: LLMFullCompletionOptions = {};
  if (useNativeTools && activeTools.length > 0) {
    completionOptions = {
      tools: activeTools,
    };
  }

  completionOptions = buildReasoningCompletionOptions(
    completionOptions,
    state.session.hasReasoningEnabled,
    selectedChatModel,
  );

  // Construct messages (excluding system message)
  const baseSystemMessage = getBaseSystemMessage(
    state.session.mode,
    selectedChatModel,
    activeTools,
  );

  const systemMessage = systemToolsFramework
    ? addSystemMessageToolsToSystemMessage(
        systemToolsFramework,
        baseSystemMessage,
        activeTools,
      )
    : baseSystemMessage;

  const withoutMessageIds = state.session.history.map((item) => {
    const { id, ...messageWithoutId } = item.message;
    return { ...item, message: messageWithoutId };
  });

  const { messages, appliedRules, appliedRuleIndex } = constructMessages(
    withoutMessageIds,
    systemMessage,
    state.config.config.rules,
    state.ui.ruleSettings,
    systemToolsFramework,
  );

  // parallel tool calls will cause issues with this
  // because there will be multiple tool messages, so which one should have applied rules?
  dispatch(
    setAppliedRulesAtIndex({
      index: appliedRuleIndex,
      appliedRules: appliedRules,
    }),
  );

  dispatch(setActive());
  dispatch(setInlineErrorMessage(undefined));

  const precompiledRes = await extra.ideMessenger.request("llm/compileChat", {
    messages,
    options: completionOptions,
  });

  if (precompiledRes.status === "error") {
    if (precompiledRes.error.includes("Not enough context")) {
      dispatch(setInlineErrorMessage("out-of-context"));
      dispatch(setInactive());
      return;
    } else {
      throw new Error(precompiledRes.error);
    }
  }

  const { compiledChatMessages, didPrune, contextPercentage } =
    precompiledRes.content;

  dispatch(setIsPruned(didPrune));
  dispatch(setContextPercentage(contextPercentage));

  const streamAborter = getState().session.streamAborter;
  try {
    let gen = extra.ideMessenger.llmStreamChat(
      {
        completionOptions,
        title: selectedChatModel.title,
        messages: compiledChatMessages,
        legacySlashCommandData,
        messageOptions: { precompiled: true },
      },
      streamAborter.signal,
    );
    if (systemToolsFramework && activeTools.length > 0) {
      gen = interceptSystemToolCalls(
        gen,
        streamAborter,
        systemToolsFramework,
      );
    }

    const renderBatch = createStreamRenderBatcher(dispatch);
    let next = await gen.next();
    while (!next.done) {
      if (streamAborter.signal.aborted) {
        break;
      }

      const chunk = next.value as ChatMessage[] | undefined;
      if (chunk?.length) {
        renderBatch.push(chunk);
      }
      next = await gen.next();
    }
    renderBatch.flushNow();

    if (next.done && next.value) {
      dispatch(addPromptCompletionPair([next.value]));
    }
  } catch (e) {
    const toolCallsToCancel = selectCurrentToolCalls(getState());
    if (
      toolCallsToCancel.length > 0 &&
      e instanceof Error &&
      e.message.toLowerCase().includes("premature close")
    ) {
      for (const tc of toolCallsToCancel) {
        dispatch(
          errorToolCall({
            toolCallId: tc.toolCallId,
            output: [
              {
                name: "Tool Call Error",
                description: "Premature Close",
                content: `"Premature Close" error: this tool call was aborted mid-stream because the arguments took too long to stream or there were network issues. Please re-attempt by breaking the operation into smaller chunks or trying something else`,
                icon: "problems",
              },
            ],
          }),
        );
      }
      // Do not continue into tool execution with incomplete arguments. The
      // previous behavior swallowed the transport failure and attempted to
      // execute the partially streamed call, which could strand the agent
      // or run a malformed command. Let the wrapper surface the failure so
      // the user can retry safely.
      throw e;
    } else {
      throw e;
    }
  }

  // Tool call sequence:
  // 1. Mark generating tool calls as generated
  const state1 = getState();
  if (streamAborter.signal.aborted) {
    return;
  }
  const originalToolCalls = selectCurrentToolCalls(state1);
  const generatingCalls = originalToolCalls.filter(
    (tc) => tc.status === "generating",
  );
  for (const { toolCallId } of generatingCalls) {
    dispatch(
      setToolGenerated({
        toolCallId,
        tools: state1.config.config.tools,
      }),
    );
  }

  // 2. Pre-process args to catch invalid args before checking policies
  const state2 = getState();
  if (streamAborter.signal.aborted) {
    return;
  }
  const generatedCalls2 = selectPendingToolCalls(state2);
  await preprocessToolCalls(dispatch, extra.ideMessenger, generatedCalls2);

  // 3. Security check: evaluate updated policies based on args
  const state3 = getState();
  if (streamAborter.signal.aborted) {
    return;
  }
  const generatedCalls3 = selectPendingToolCalls(state3);
  const toolPolicies = state3.ui.toolSettings;
  const policies = await evaluateToolPolicies(
    dispatch,
    extra.ideMessenger,
    activeTools,
    generatedCalls3,
    toolPolicies,
    {
      agentAccessMode: state3.ui.agentAccessMode,
      terminalAutoExecution: state3.ui.terminalAutoExecution,
    },
  );
  const autoApprovedPolicies = policies.filter(
    ({ policy }) => policy === "allowedWithoutPermission",
  );
  const needsApprovalPolicies = policies.filter(
    ({ policy }) => policy === "allowedWithPermission",
  );

  // 4. Execute remaining tool calls
  if (originalToolCalls.length === 0) {
    dispatch(setInactive());
  } else if (needsApprovalPolicies.length > 0) {
    if (autoApprovedPolicies.length > 0) {
      if (streamAborter.signal.aborted) {
        return;
      }
      await runParallelToolCalls(
        dispatch,
        autoApprovedPolicies.map(({ toolCallState }) => toolCallState.toolCallId),
        {
          depth: depth + 1,
          isAutoApproved: true,
          deferToolResults: true,
          resumeAgent: false,
        },
      );
    }

    dispatch(setInactive());
  } else {
    const generatedCalls4 = selectPendingToolCalls(getState());
    if (streamAborter.signal.aborted) {
      return;
    }
    if (generatedCalls4.length > 0) {
      await runParallelToolCalls(
        dispatch,
        generatedCalls4.map(({ toolCallId }) => toolCallId),
        {
          depth: depth + 1,
          isAutoApproved: true,
          deferToolResults: true,
          resumeAgent: true,
        },
      );
    } else {
      const lastToolCallId =
        originalToolCalls[originalToolCalls.length - 1]?.toolCallId;
      if (lastToolCallId) {
        unwrapResult(
          await dispatch(
            streamResponseAfterToolCall({
              toolCallId: lastToolCallId,
              depth: depth + 1,
            }),
          ),
        );
      }
    }
  }
}
