import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { useAppSelector } from "../../../redux/hooks";
import { RootState } from "../../../redux/store";
import {
  CHAT_TOOL_ROW_CLASS,
  CHAT_TOOL_STACK_CLASS,
} from "../../../styles/chatLayout";
import FunctionSpecificToolCallDiv from "./FunctionSpecificToolCallDiv";
import { McpAppRenderer } from "./MCPAppRenderer";
import { SimpleToolCallUI } from "./SimpleToolCallUI";
import { ToolCallDisplay } from "./ToolCallDisplay";
import { ToolCallStatusMessage } from "./ToolCallStatusMessage";
import { PlanCard } from "./PlanCard";
import { getToolCallIcon, isFileOrDirectoryTool } from "./utils";

interface ToolCallDivProps {
  toolCallStates: ToolCallState[];
  historyIndex: number;
}

export function ToolCallDiv({
  toolCallStates,
  historyIndex,
}: ToolCallDivProps) {
  const availableTools = useAppSelector(
    (state: RootState) => state.config.config.tools,
  );

  if (!toolCallStates?.length) return null;

  const planCalls = toolCallStates.filter(
    (call) => call.toolCall.function?.name === BuiltInToolNames.CreatePlan,
  );
  const otherCalls = toolCallStates.filter(
    (call) => call.toolCall.function?.name !== BuiltInToolNames.CreatePlan,
  );

  const renderToolCall = (toolCallState: ToolCallState) => {
    const tool =
      availableTools.find(
        (tool) => toolCallState.toolCall.function?.name === tool.function.name,
      ) ?? toolCallState.tool;
    const functionName = toolCallState.toolCall.function?.name;
    const icon = isFileOrDirectoryTool(functionName)
      ? undefined
      : getToolCallIcon(functionName, tool?.group, tool?.toolCallIcon);
    const ActionIcon = icon;
    const iconNode = ActionIcon ? (
      <ActionIcon
        aria-hidden="true"
        focusable="false"
        className="h-4 w-4 text-description"
      />
    ) : null;

    if (toolCallState.mcpUiState) {
      return (
        <ToolCallDisplay
          icon={iconNode}
          tool={tool}
          toolCallState={toolCallState}
          historyIndex={historyIndex}
        >
          <McpAppRenderer toolCallState={toolCallState} />
        </ToolCallDisplay>
      );
    }

    if (
      tool?.toolCallIcon &&
      functionName !== BuiltInToolNames.SingleFindAndReplace &&
      functionName !== BuiltInToolNames.MultiEdit &&
      functionName !== BuiltInToolNames.RunTerminalCommand
    ) {
      return (
        <SimpleToolCallUI
          tool={tool}
          toolCallState={toolCallState}
          icon={isFileOrDirectoryTool(functionName)
            ? undefined
            : toolCallState.status === "generated"
              ? ArrowRightIcon
              : icon}
          historyIndex={historyIndex}
        />
      );
    }

    if (
      functionName === BuiltInToolNames.SingleFindAndReplace ||
      functionName === BuiltInToolNames.MultiEdit ||
      functionName === BuiltInToolNames.RunTerminalCommand
    ) {
      return (
        <div className="flex flex-col px-0">
          {functionName !== BuiltInToolNames.RunTerminalCommand && (
            <div className="agent-activity-row text-description">
              {iconNode && <span className="agent-activity-action-icon flex-shrink-0">{iconNode}</span>}
              <ToolCallStatusMessage tool={tool} toolCallState={toolCallState} />
            </div>
          )}
          <FunctionSpecificToolCallDiv
            toolCallState={toolCallState}
            historyIndex={historyIndex}
          />
        </div>
      );
    }

    return (
      <ToolCallDisplay
        icon={iconNode}
        tool={tool}
        toolCallState={toolCallState}
        historyIndex={historyIndex}
      >
        <FunctionSpecificToolCallDiv
          toolCallState={toolCallState}
          historyIndex={historyIndex}
        />
      </ToolCallDisplay>
    );
  };

  const planCards = planCalls.map((toolCallState) => (
    <PlanCard
      key={toolCallState.toolCallId}
      toolCallState={toolCallState}
      alongsideResearch={otherCalls.length > 0}
    />
  ));

  if (otherCalls.length === 0) {
    return (
      <div className={`${CHAT_TOOL_STACK_CLASS} ${CHAT_TOOL_ROW_CLASS}`}>
        {planCards}
      </div>
    );
  }

  return (
    <div className={CHAT_TOOL_STACK_CLASS}>
      {planCards.length > 0 && (
        <div className={CHAT_TOOL_ROW_CLASS}>{planCards}</div>
      )}
      {otherCalls.map((toolCallState) => (
        <div className={CHAT_TOOL_ROW_CLASS} key={toolCallState.toolCallId}>
          {renderToolCall(toolCallState)}
        </div>
      ))}
    </div>
  );
}
