import { ToolPolicy } from "terminal-security";
import { Tool, ToolCallState } from "core";
import type {
  AgentAccessMode,
  TerminalAutoExecution,
} from "core/tools/policies/agentAccess";
import {
  DEFAULT_AGENT_ACCESS_MODE,
  DEFAULT_TERMINAL_AUTO_EXECUTION,
} from "core/tools/policies/agentAccess";
import { IIdeMessenger } from "../../context/IdeMessenger";
import { errorToolCall, updateToolCallOutput } from "../slices/sessionSlice";
import { DEFAULT_TOOL_SETTING, ToolPolicies } from "../slices/uiSlice";
import { AppThunkDispatch } from "../store";

interface EvaluatedPolicy {
  policy: ToolPolicy;
  displayValue?: string;
  toolCallState: ToolCallState;
}

export interface EvaluateToolPoliciesOptions {
  agentAccessMode?: AgentAccessMode;
  terminalAutoExecution?: TerminalAutoExecution;
}

/**
 * Evaluates the tool policy for a tool call, including dynamic policy evaluation
 * Note that tool group policies are not considered here because activeTools already excludes disabled groups
 */
async function evaluateToolPolicy(
  ideMessenger: IIdeMessenger,
  activeTools: Tool[],
  toolCallState: ToolCallState,
  toolPolicies: ToolPolicies,
  options: EvaluateToolPoliciesOptions,
): Promise<EvaluatedPolicy> {
  const basePolicy =
    toolPolicies[toolCallState.toolCall.function.name] ??
    activeTools.find(
      (tool) => tool.function.name === toolCallState.toolCall.function.name,
    )?.defaultToolPolicy ??
    DEFAULT_TOOL_SETTING;

  const toolName = toolCallState.toolCall.function.name;
  const result = await ideMessenger.request("tools/evaluatePolicy", {
    toolName,
    basePolicy,
    parsedArgs: toolCallState.parsedArgs,
    processedArgs: toolCallState.processedArgs,
    agentAccessMode: options.agentAccessMode ?? DEFAULT_AGENT_ACCESS_MODE,
    terminalAutoExecution:
      options.terminalAutoExecution ?? DEFAULT_TERMINAL_AUTO_EXECUTION,
  });

  // Evaluate the policy dynamically
  if (result.status === "error") {
    console.error(`Error evaluating tool policy for ${toolName}`, result.error);
    return { policy: "disabled", toolCallState };
  }

  const dynamicPolicy = result.content.policy;
  const displayValue = result.content.displayValue;

  // Per-tool "disabled" always wins. Otherwise the mode-aware dynamic
  // policy from core is the source of truth (Agent Access / Terminal Auto Execution).
  if (basePolicy === "disabled") {
    return { policy: "disabled", displayValue, toolCallState };
  }

  return { policy: dynamicPolicy, displayValue, toolCallState };
}

/*
    1. Get arg-dependent tool policies from core
    2. Mark any disabled ones as errored
    3. Mark others as generated
*/
export async function evaluateToolPolicies(
  dispatch: AppThunkDispatch,
  ideMessenger: IIdeMessenger,
  activeTools: Tool[],
  generatedToolCalls: ToolCallState[],
  toolPolicies: ToolPolicies,
  options: EvaluateToolPoliciesOptions = {},
): Promise<EvaluatedPolicy[]> {
  // Check if ALL tool calls are auto-approved using dynamic evaluation
  const policyResults = await Promise.all(
    generatedToolCalls.map((toolCallState) =>
      evaluateToolPolicy(
        ideMessenger,
        activeTools,
        toolCallState,
        toolPolicies,
        options,
      ),
    ),
  );

  const disabledResults = policyResults.filter(
    ({ policy }) => policy === "disabled",
  );

  for (const { displayValue, toolCallState } of disabledResults) {
    dispatch(errorToolCall({ toolCallId: toolCallState.toolCallId }));

    // Use the displayValue from the policy evaluation, or fallback to function name
    const command = displayValue || toolCallState.toolCall.function.name;

    // Add error message explaining why it's disabled
    dispatch(
      updateToolCallOutput({
        toolCallId: toolCallState.toolCallId,
        contextItems: [
          {
            icon: "problems",
            name: "Security Policy Violation",
            description: "Command Disabled",
            content: `This command has been disabled by security policy:\n\n${command}\n\nThis command cannot be executed as it may pose a security risk.`,
            hidden: false,
          },
        ],
      }),
    );
  }

  return policyResults;
}
