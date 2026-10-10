import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import {
  ChatMessage,
  LLMFullCompletionOptions,
  ModelDescription,
  Tool,
} from "core";
import { ToCoreProtocol } from "core/protocol";
import { selectActiveTools } from "../selectors/selectActiveTools";
import { selectSelectedChatModel } from "../slices/configSlice";
import {
  addPromptCompletionPair,
  errorToolCall,
  updateToolCallOutput,
  resetNextCodeBlockToApplyIndex,
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
import { canResumeAfterToolCall } from "./streamResponseAfterToolCall";
import {
  agentStepLimitMessage,
  isAgentStepLimitReached,
  resolveMaxAgentSteps,
} from "../../util/agentLoopLimits";
import { createStreamRenderBatcher } from "../util/streamRenderBatch";
import { withAgentStreamLock } from "../util/agentStreamLock";
import {
  isOverloadedErrorMessage,
  markOverloadRetriesExhausted,
  OVERLOADED_RETRIES,
  overloadRetryDelayMs,
} from "../util/overloadRetry";
import { analyzeError } from "../../util/errorAnalysis";
import { nextWithIdleTimeout } from "../util/streamIdleTimeout";
import { runParallelToolCalls } from "../util/agentToolPipeline";
import {
  ensureAgentTurnInactive,
  PostStreamPhaseResult,
} from "../util/agentStreamContinuation";
import {
  resolveAgentContinuationNudge,
  shouldAutoContinueAgentDriverTurn,
} from "core/llm/streamContinuation";
import { renderChatMessage } from "core/util/messageContent";

const MAX_INCOMPLETE_AGENT_DRIVER_RETRIES = 3;

function getLastUserMessageText(getState: () => RootState): string {
  for (let i = getState().session.history.length - 1; i >= 0; i--) {
    const msg = getState().session.history[i].message;
    if (msg.role === "user") {
      return renderChatMessage(msg);
    }
  }
  return "";
}

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
    await runAgentDriver({
      legacySlashCommandData,
      depth,
      dispatch,
      extra,
      getState,
    });
  },
);

/**
 * Retries one LLM turn on transient overload errors. The unit of retry is the
 * turn, so completed earlier turns are never re-run.
 */
async function runTurnWithOverloadRetry<T>(
  selectedChatModel: Parameters<typeof analyzeError>[1],
  runTurn: () => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await runTurn();
    } catch (e) {
      const { message } = analyzeError(e, selectedChatModel);
      if (!isOverloadedErrorMessage(message)) {
        throw e;
      }
      if (attempt >= OVERLOADED_RETRIES) {
        markOverloadRetriesExhausted(e);
        throw e;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, overloadRetryDelayMs(attempt)),
      );
    }
  }
}

/**
 * Iterative agent driver: runs LLM turns in a loop until a turn ends with no
 * tool work to resume. Callers (the thunk and resumed tool completions) share
 * this single driver instead of nesting one thunk inside another.
 */
export async function runAgentDriver({
  legacySlashCommandData,
  depth,
  dispatch,
  extra,
  getState,
}: {
  legacySlashCommandData?: ToCoreProtocol["llm/streamChat"][0]["legacySlashCommandData"];
  depth: number;
  dispatch: AppDispatch;
  extra: ThunkApiType["extra"];
  getState: () => RootState;
}): Promise<void> {
    const selectedChatModel = selectSelectedChatModel(getState());

    if (!selectedChatModel) {
      throw new Error("No chat model selected");
    }

    // Stream one LLM turn under the stream lock, then run tool execution
    // after release. Follow-up turns iterate in this loop; the stream lock is
    // never held across post-stream tool work, so nested resumes cannot deadlock.
    let currentDepth = depth;
    let incompleteDriverRetries = 0;
    for (;;) {
      // A continuation must not start after the user cancelled. cancelStream
      // clears isStreaming; the first turn sets it itself, so only continuations
      // are checked.
      if (currentDepth > depth && !getState().session.isStreaming) {
        ensureAgentTurnInactive(dispatch, getState);
        return;
      }
      if (isAgentStepLimitReached(currentDepth, getState().config.config.ui)) {
        const maxSteps = resolveMaxAgentSteps(getState().config.config.ui);
        const message = agentStepLimitMessage(maxSteps);
        if (process.env.NODE_ENV === "test") {
          console.error(message, JSON.stringify(getState(), null, 2));
          throw new Error(message);
        }
        dispatch(setInlineErrorMessage("max-agent-steps"));
        dispatch(setInactive());
        return;
      }
      dispatch(setAgentStepDepth(currentDepth));

      let streamOutcome = await runTurnWithOverloadRetry(selectedChatModel, () =>
        withAgentStreamLock(async () =>
          runStreamNormalInputLocked({
            legacySlashCommandData,
            depth: currentDepth,
            dispatch,
            extra,
            getState,
            selectedChatModel,
          }),
        ),
      );
      if (!streamOutcome) {
        ensureAgentTurnInactive(dispatch, getState);
        return;
      }

      let next = await runPostStreamToolPhase({
        depth: currentDepth,
        dispatch,
        extra,
        getState,
        streamAborter: streamOutcome.streamAborter,
        activeTools: streamOutcome.activeTools,
      });

      while (
        next === "stop" &&
        incompleteDriverRetries < MAX_INCOMPLETE_AGENT_DRIVER_RETRIES
      ) {
        const last = getState().session.history.at(-1);
        const lastText =
          last?.message.role === "assistant"
            ? renderChatMessage(last.message)
            : "";
        const hasUnsettledToolWork =
          selectPendingToolCalls(getState()).length > 0 ||
          selectCurrentToolCalls(getState()).some(
            (tc) => tc.status === "generating" || tc.status === "generated",
          );
        const lastUserText = getLastUserMessageText(getState);
        if (
          !shouldAutoContinueAgentDriverTurn({
            mode: getState().session.mode,
            hasActiveTools: streamOutcome.activeTools.length > 0,
            lastAssistantText: lastText,
            lastUserText,
            streamAborted: streamOutcome.streamAborter.signal.aborted,
            hasUnsettledToolWork,
          })
        ) {
          break;
        }
        incompleteDriverRetries++;
        const continuationNudge = resolveAgentContinuationNudge(
          lastText,
          lastUserText,
        );
        const retried = await runTurnWithOverloadRetry(selectedChatModel, () =>
          withAgentStreamLock(async () =>
            runStreamNormalInputLocked({
              legacySlashCommandData,
              depth: currentDepth,
              dispatch,
              extra,
              getState,
              selectedChatModel,
              ephemeralMessages: [
                { role: "user", content: continuationNudge },
              ],
            }),
          ),
        );
        if (!retried) {
          break;
        }
        streamOutcome = retried;
        next = await runPostStreamToolPhase({
          depth: currentDepth,
          dispatch,
          extra,
          getState,
          streamAborter: streamOutcome.streamAborter,
          activeTools: streamOutcome.activeTools,
        });
      }

      if (next !== "continue") {
        ensureAgentTurnInactive(dispatch, getState);
        return;
      }
      currentDepth += 1;
    }
}

async function runStreamNormalInputLocked({
  legacySlashCommandData,
  depth,
  dispatch,
  extra,
  getState,
  selectedChatModel,
  ephemeralMessages,
}: {
  legacySlashCommandData?: ToCoreProtocol["llm/streamChat"][0]["legacySlashCommandData"];
  depth: number;
  dispatch: AppDispatch;
  extra: ThunkApiType["extra"];
  getState: () => RootState;
  selectedChatModel: ModelDescription;
  /** Appended only for this request; not written to session history. */
  ephemeralMessages?: ChatMessage[];
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

  let { compiledChatMessages, didPrune, contextPercentage } =
    precompiledRes.content;
  if (ephemeralMessages?.length) {
    compiledChatMessages = [...compiledChatMessages, ...ephemeralMessages];
  }

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
    let next = await nextWithIdleTimeout(gen.next());
    while (!next.done) {
      if (streamAborter.signal.aborted) {
        break;
      }

      const chunk = next.value as ChatMessage[] | undefined;
      if (chunk?.length) {
        renderBatch.push(chunk);
      }
      next = await nextWithIdleTimeout(gen.next());
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

  return { streamAborter, activeTools };
}

async function runPostStreamToolPhase({
  depth,
  dispatch,
  extra,
  getState,
  streamAborter,
  activeTools,
}: {
  depth: number;
  dispatch: AppDispatch;
  extra: ThunkApiType["extra"];
  getState: () => RootState;
  streamAborter: AbortController;
  activeTools: Tool[];
}): Promise<PostStreamPhaseResult> {
  // Tool call sequence:
  // 1. Mark generating tool calls as generated
  const state1 = getState();
  if (streamAborter.signal.aborted) {
    // An interrupted stream leaves calls in "generating", which the resume gate
    // never treats as settled. Settle them as errored so the next turn is not wedged.
    for (const tc of selectCurrentToolCalls(state1)) {
      if (tc.status === "generating") {
        dispatch(
          errorToolCall({
            toolCallId: tc.toolCallId,
            output: [
              {
                name: "Tool Call Interrupted",
                description: "Stream interrupted",
                content:
                  "This tool call was interrupted before its arguments finished streaming. Re-issue it if it is still needed.",
                icon: "problems",
              },
            ],
          }),
        );
      }
    }
    return "stop";
  }
  const originalToolCalls = selectCurrentToolCalls(state1);
  const generatingCalls = originalToolCalls.filter(
    (tc) => tc.status === "generating",
  );
  for (const tc of generatingCalls) {
    const name = tc.toolCall.function.name?.trim() ?? "";
    const args = tc.toolCall.function.arguments ?? "";
    if (name && args.trim()) {
      try {
        JSON.parse(args);
      } catch {
        dispatch(errorToolCall({ toolCallId: tc.toolCallId }));
        dispatch(
          updateToolCallOutput({
            toolCallId: tc.toolCallId,
            contextItems: [
              {
                icon: "problems",
                name: "Incomplete Tool Call",
                description: "",
                content:
                  "The model did not finish streaming valid tool arguments. The agent attempted to auto-continue but the call is still invalid. Try again or use a stronger model for tool use.",
                hidden: false,
              },
            ],
          }),
        );
        continue;
      }
    }
    dispatch(
      setToolGenerated({
        toolCallId: tc.toolCallId,
        tools: state1.config.config.tools,
      }),
    );
  }

  // 2. Pre-process args to catch invalid args before checking policies
  const state2 = getState();
  if (streamAborter.signal.aborted) {
    return "stop";
  }
  const generatedCalls2 = selectPendingToolCalls(state2);
  await preprocessToolCalls(dispatch, extra.ideMessenger, generatedCalls2);

  // 3. Security check: evaluate updated policies based on args
  const state3 = getState();
  if (streamAborter.signal.aborted) {
    return "stop";
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
      protectedFilePatterns: state3.ui.protectedFilePatterns,
      protectedPathsRequireReadApproval:
        state3.ui.protectedPathsRequireReadApproval,
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
    return "stop";
  } else if (needsApprovalPolicies.length > 0) {
    if (autoApprovedPolicies.length > 0) {
      if (streamAborter.signal.aborted) {
        return "stop";
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
    return "stop";
  } else {
    const generatedCalls4 = selectPendingToolCalls(getState());
    if (streamAborter.signal.aborted) {
      return "stop";
    }
    if (generatedCalls4.length > 0) {
      const pendingIds = generatedCalls4.map(({ toolCallId }) => toolCallId);
      await runParallelToolCalls(dispatch, pendingIds, {
        depth: depth + 1,
        isAutoApproved: true,
        deferToolResults: true,
        resumeAgent: false,
      });
      const anchorId = pendingIds[pendingIds.length - 1];
      dispatch(resetNextCodeBlockToApplyIndex());
      if (
        !canResumeAfterToolCall(
          getState().session.history,
          anchorId,
          getState().config.config.ui?.resumeAfterToolRejection,
        )
      ) {
        return "stop";
      }
      if (!getState().session.isStreaming) {
        dispatch(setActive());
      }
      return "continue";
    } else {
      const lastToolCallId =
        originalToolCalls[originalToolCalls.length - 1]?.toolCallId;
      // Only resume when this turn itself generated tool calls. A call that
      // settled in an earlier turn must not re-trigger another LLM turn.
      if (lastToolCallId && generatingCalls.length > 0) {
        // An aborted stream must not start another turn (HEAD guarded this
        // dispatch with the same check).
        if (streamAborter.signal.aborted) {
          return "stop";
        }
        // Finalize exactly as the resume thunk did, then let the loop take
        // the next turn instead of re-entering streamNormalInput recursively.
        dispatch(resetNextCodeBlockToApplyIndex());
        if (
          !canResumeAfterToolCall(
            getState().session.history,
            lastToolCallId,
            getState().config.config.ui?.resumeAfterToolRejection,
          )
        ) {
          return "stop";
        }
        if (!getState().session.isStreaming) {
          dispatch(setActive());
        }
        return "continue";
      }
    }
  }
  return "stop";
}
