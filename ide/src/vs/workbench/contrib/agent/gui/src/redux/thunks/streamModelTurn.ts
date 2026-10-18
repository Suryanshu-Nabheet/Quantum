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
  completeOpenTodos,
  setIsPruned,
  setToolGenerated,
  recoverMarkdownJsonToolCallOnLastAssistant,
} from "../slices/sessionSlice";
import { tryParseMarkdownJsonToolCall } from "core/tools/markdownJsonToolCall";
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
import { historyHasResearch, planBriefBlock } from "core/tools/implementations/createPlan";
import { todosSystemBlock } from "core/tools/implementations/writeTodos";
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
import {
  runParallelToolCalls,
  toAgentToolCallRef,
} from "../util/agentToolPipeline";
import {
  ensureAgentTurnInactive,
  PostStreamPhaseResult,
} from "../util/agentStreamContinuation";
import { renderChatMessage } from "core/util/messageContent";
import { BuiltInToolNames } from "core/tools/builtIn";
import { BROWSER_TOOL_GROUP } from "core/tools/definitions/browserTools";
import {
  assistantReplyIsUnfinished,
  shouldResumeAgentAfterIdleReply,
  userRequestedAutonomousCodebaseWork,
  withAgentIdleResumeNudge,
} from "core/llm/streamContinuation";
import { injectQueuedMessageIfReady } from "./drainMessageQueue";

let driverTail: Promise<void> = Promise.resolve();

/** Resolves when the in-flight agent driver has returned. */
export function waitForAgentDriver(): Promise<void> {
  return driverTail;
}

/** A finished-looking short note may restart a few times. A lead-in may restart more. */
const MAX_IDLE_RESUMES = 4;
const MAX_UNFINISHED_RESUMES = 8;
const MAX_FAILURE_RESUMES = 4;
/** Autonomous request that has not completed a tool yet. */
const MAX_UNSTARTED_RESUMES = 8;

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

export const streamModelTurn = createAsyncThunk<
  void,
  {
    legacySlashCommandData?: ToCoreProtocol["llm/streamChat"][0]["legacySlashCommandData"];
    depth?: number;
  },
  ThunkApiType
>(
  "chat/streamModelTurn",
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

function userTurnHasSuccessfulTool(
  history: RootState["session"]["history"],
): boolean {
  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i];
    if (item.message.role === "user") {
      return false;
    }
    if (
      (item.toolCallStates ?? []).some(
        (call) =>
          call.status === "done" &&
          call.toolCall.function?.name !== BuiltInToolNames.CreatePlan,
      )
    ) {
      return true;
    }
  }
  return false;
}

function userTurnAlreadyUsedTools(
  history: RootState["session"]["history"],
): boolean {
  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i];
    if (item.message.role === "user") {
      return false;
    }
    const calls = item.toolCallStates ?? [];
    if (
      calls.some((call) => {
        const name = call.toolCall.function?.name;
        return !!name && name !== BuiltInToolNames.CreatePlan;
      })
    ) {
      return true;
    }
  }
  return false;
}

function lastAssistantToolsAllErrored(
  history: RootState["session"]["history"],
): boolean {
  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i];
    if (item.message.role === "user") {
      return false;
    }
    if (item.message.role !== "assistant") {
      continue;
    }
    const calls = item.toolCallStates ?? [];
    if (calls.length === 0) {
      return false;
    }
    return calls.every((call) => call.status === "errored");
  }
  return false;
}

function lastAssistantText(history: RootState["session"]["history"]): string {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].message.role === "assistant") {
      return renderChatMessage(history[i].message);
    }
    if (history[i].message.role === "user") {
      break;
    }
  }
  return "";
}

function turnWantsBrowser(history: RootState["session"]["history"]): boolean {
  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i];
    if (item.message.role !== "user") {
      continue;
    }
    if (/\b(browser|webpage|localhost|https?:\/\/)\b/i.test(renderChatMessage(item.message))) {
      return true;
    }
    return (item.contextItems ?? []).some((entry) =>
      /browser/i.test(entry.id.providerTitle),
    );
  }
  return false;
}

function lastUserText(history: RootState["session"]["history"]): string {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].message.role === "user") {
      return renderChatMessage(history[i].message);
    }
  }
  return "";
}

function agentStoppedBeforeFinishing(state: RootState): boolean {
  if (state.session.mode !== "agent") {
    return false;
  }
  const history = state.session.history;
  const todos = state.session.todos ?? [];
  return shouldResumeAgentAfterIdleReply({
    text: lastAssistantText(history),
    lastUserText: lastUserText(history),
    turnAlreadyUsedTools: userTurnAlreadyUsedTools(history),
    hasOpenTodos: todos.some((todo) => todo.status !== "done"),
  });
}

/**
 * Iterative agent driver: runs LLM turns in a loop until a turn ends with no
 * tool work to resume. A prose stop or a failed tool batch in agent mode
 * restarts the turn, up to a small cap, so the task is not abandoned mid-way.
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
  let releaseDriver = () => {};
  const settled = new Promise<void>((resolve) => {
    releaseDriver = resolve;
  });
  driverTail = driverTail.then(() => settled);
  const streamEpoch = getState().session.streamEpoch ?? 0;
  try {
    const selectedChatModel = selectSelectedChatModel(getState());

    if (!selectedChatModel) {
      throw new Error("No chat model selected");
    }

    // Stream one LLM turn under the stream lock, then run tool execution
    // after release. Follow-up turns iterate in this loop; the stream lock is
    // never held across post-stream tool work, so nested resumes cannot deadlock.
    let currentDepth = depth;
    let resumeAfterIdle = false;
    let idleResumes = 0;
    let unfinishedResumes = 0;
    let failureResumes = 0;
    let unstartedResumes = 0;
    for (;;) {
      if ((getState().session.streamEpoch ?? 0) !== streamEpoch) {
        return;
      }
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
          runStreamModelTurnLocked({
            legacySlashCommandData,
            depth: currentDepth,
            dispatch,
            extra,
            getState,
            selectedChatModel,
            resumeAfterIdle,
          }),
        ),
      );
      if (!streamOutcome) {
        ensureAgentTurnInactive(dispatch, getState);
        return;
      }

      const next = await runPostStreamToolPhase({
        depth: currentDepth,
        dispatch,
        extra,
        getState,
        streamAborter: streamOutcome.streamAborter,
        activeTools: streamOutcome.activeTools,
      });

      if (next === "continue") {
        resumeAfterIdle = false;
        idleResumes = 0;
        unfinishedResumes = 0;
        failureResumes = 0;
        unstartedResumes = 0;
        if ((getState().session.streamEpoch ?? 0) === streamEpoch) {
          await injectQueuedMessageIfReady("break", dispatch, extra, getState);
        }
        currentDepth += 1;
        continue;
      }

      const state = getState();
      if (state.session.isStreaming && state.session.mode === "agent") {
        const history = state.session.history;
        if (
          lastAssistantToolsAllErrored(history) &&
          failureResumes < MAX_FAILURE_RESUMES
        ) {
          failureResumes += 1;
          resumeAfterIdle = true;
          currentDepth += 1;
          continue;
        }
        if (
          !userTurnHasSuccessfulTool(history) &&
          userRequestedAutonomousCodebaseWork(lastUserText(history)) &&
          unstartedResumes < MAX_UNSTARTED_RESUMES
        ) {
          unstartedResumes += 1;
          resumeAfterIdle = true;
          currentDepth += 1;
          continue;
        }
        if (
          !lastAssistantToolsAllErrored(history) &&
          agentStoppedBeforeFinishing(state)
        ) {
          const text = lastAssistantText(state.session.history);
          const unfinished = assistantReplyIsUnfinished(text);
          if (unfinished && unfinishedResumes < MAX_UNFINISHED_RESUMES) {
            unfinishedResumes += 1;
            resumeAfterIdle = true;
            currentDepth += 1;
            continue;
          }
          if (!unfinished && idleResumes < MAX_IDLE_RESUMES) {
            idleResumes += 1;
            resumeAfterIdle = true;
            currentDepth += 1;
            continue;
          }
        }
      }

      if (
        (getState().session.streamEpoch ?? 0) === streamEpoch &&
        getState().session.isStreaming &&
        (await injectQueuedMessageIfReady("done", dispatch, extra, getState))
      ) {
        resumeAfterIdle = false;
        idleResumes = 0;
        unfinishedResumes = 0;
        failureResumes = 0;
        unstartedResumes = 0;
        currentDepth += 1;
        continue;
      }

      const finished = getState();
      if (
        (finished.session.streamEpoch ?? 0) === streamEpoch &&
        selectPendingToolCalls(finished).length === 0 &&
        !assistantReplyIsUnfinished(lastAssistantText(finished.session.history))
      ) {
        dispatch(completeOpenTodos());
      }
      ensureAgentTurnInactive(dispatch, getState);
      return;
    }
  } finally {
    releaseDriver();
  }
}

async function runStreamModelTurnLocked({
  legacySlashCommandData,
  depth,
  dispatch,
  extra,
  getState,
  selectedChatModel,
  resumeAfterIdle,
}: {
  legacySlashCommandData?: ToCoreProtocol["llm/streamChat"][0]["legacySlashCommandData"];
  depth: number;
  dispatch: AppDispatch;
  extra: ThunkApiType["extra"];
  getState: () => RootState;
  selectedChatModel: ModelDescription;
  resumeAfterIdle: boolean;
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
  if (!turnWantsBrowser(state.session.history)) {
    activeTools = activeTools.filter((tool) => tool.group !== BROWSER_TOOL_GROUP);
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

  const systemMessage = `${
    systemToolsFramework
      ? addSystemMessageToolsToSystemMessage(
          systemToolsFramework,
          baseSystemMessage,
          activeTools,
        )
      : baseSystemMessage
  }${
    state.session.mode === "agent"
      ? `${planBriefBlock(state.session.planBrief)}${todosSystemBlock(state.session.todos)}`
      : ""
  }`;

  const withoutMessageIds = state.session.history.map((item) => {
    const { id, ...messageWithoutId } = item.message;
    return { ...item, message: messageWithoutId };
  });

  const constructed = constructMessages(
    withoutMessageIds,
    systemMessage,
    state.config.config.rules,
    state.ui.ruleSettings,
    systemToolsFramework,
  );
  const { appliedRules, appliedRuleIndex } = constructed;
  const messages = resumeAfterIdle
    ? withAgentIdleResumeNudge(constructed.messages)
    : constructed.messages;

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

  const precompiledRes = await extra.hostBridge.request("llm/assembleChat", {
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
    let gen = extra.hostBridge.llmStreamChat(
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
    const message = e instanceof Error ? e.message.toLowerCase() : "";
    const dropped =
      message.includes("premature close") ||
      message.includes("stopped responding");
    if (!dropped) {
      throw e;
    }
    const toolCallsToCancel = selectCurrentToolCalls(getState());
    for (const tc of toolCallsToCancel) {
      if (tc.status !== "generating" && tc.status !== "generated") {
        continue;
      }
      dispatch(
        errorToolCall({
          toolCallId: tc.toolCallId,
          output: [
            {
              name: "Tool Call Error",
              description: "Stream dropped",
              content:
                "The stream dropped before this tool call finished. The arguments were not executed. Re-issue the call in smaller pieces.",
              icon: "problems",
            },
          ],
        }),
      );
    }
    const last = getState().session.history.at(-1);
    const hasPartial =
      toolCallsToCancel.length > 0 ||
      (last?.message.role === "assistant" &&
        renderChatMessage(last.message).trim().length > 0);
    if (!hasPartial) {
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

  if (selectCurrentToolCalls(getState()).length === 0) {
    const last = getState().session.history.at(-1);
    if (last?.message.role === "assistant") {
      const recovered = tryParseMarkdownJsonToolCall(
        renderChatMessage(last.message),
        activeTools,
      );
      if (recovered) {
        dispatch(recoverMarkdownJsonToolCallOnLastAssistant(recovered));
      }
    }
  }

  const originalToolCalls = selectCurrentToolCalls(getState());
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
  const state2 = getState(); // after recovery
  if (streamAborter.signal.aborted) {
    return "stop";
  }
  const generatedCalls2 = selectPendingToolCalls(state2);
  await preprocessToolCalls(dispatch, extra.hostBridge, generatedCalls2);

  // 3. Security check: evaluate updated policies based on args
  const state3 = getState();
  if (streamAborter.signal.aborted) {
    return "stop";
  }
  const generatedCalls3 = selectPendingToolCalls(state3);
  const toolPolicies = state3.ui.toolSettings;
  const policies = await evaluateToolPolicies(
    dispatch,
    extra.hostBridge,
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
        autoApprovedPolicies.map(({ toolCallState }) =>
          toAgentToolCallRef(toolCallState),
        ),
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
      const planCalls = generatedCalls4.filter(
        (call) => call.toolCall.function?.name === BuiltInToolNames.CreatePlan,
      );
      const otherCalls = generatedCalls4
        .filter((call) => call.toolCall.function?.name !== BuiltInToolNames.CreatePlan)
        .map((call) => toAgentToolCallRef(call));
      const otherIds = otherCalls.map((call) => call.toolCallId);
      const planBeforeResearch =
        planCalls.length > 0 &&
        (otherIds.length > 0 ||
          !historyHasResearch(
            getState().session.history.flatMap((item) =>
              (item.toolCallStates ?? []).map((call) => ({
                name: call.toolCall.function?.name,
                status: call.status,
              })),
            ),
          ));
      if (planBeforeResearch) {
        if (otherIds.length > 0) {
          await runParallelToolCalls(dispatch, otherCalls, {
            depth: depth + 1,
            isAutoApproved: true,
            deferToolResults: true,
            resumeAgent: false,
          });
        }
        for (const planCall of planCalls) {
          dispatch(
            errorToolCall({
              toolCallId: planCall.toolCallId,
              output: [
                {
                  name: "Plan",
                  description: "Research first",
                  content:
                    "Do not call create_plan yet. Finish searching and reading the relevant files. Then call create_plan once, by itself, as the last action.",
                  hidden: true,
                },
              ],
            }),
          );
        }
        const anchorId = otherIds.at(-1) ?? planCalls.at(-1)?.toolCallId;
        if (!anchorId || streamAborter.signal.aborted) {
          return "stop";
        }
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
      }
      const pendingCalls = generatedCalls4.map((call) => toAgentToolCallRef(call));
      const pendingIds = pendingCalls.map((call) => call.toolCallId);
      await runParallelToolCalls(dispatch, pendingCalls, {
        depth: depth + 1,
        isAutoApproved: true,
        deferToolResults: true,
        resumeAgent: false,
      });
      if (planCalls.length > 0) {
        return "stop";
      }
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
        // the next turn instead of re-entering streamModelTurn recursively.
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
