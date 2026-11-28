import { Tool, ToolCallState } from "core";
import { useContext, useMemo } from "react";
import { openContextItem } from "../../../components/mainInput/belowMainInput/ContextItemsPeek";
import { HostBridgeContext } from "../../../context/HostBridge";
import { ToolCallStatusMessage } from "./ToolCallStatusMessage";
import { toolCallStateToContextItems } from "./utils";
import { ToolTruncateHistoryIcon } from "./ToolTruncateHistoryIcon";

interface ToolCallDisplayProps {
  children: React.ReactNode;
  icon: React.ReactNode;
  tool: Tool | undefined;
  toolCallState: ToolCallState;
  historyIndex: number;
}

export function ToolCallDisplay({
  tool,
  toolCallState,
  children,
  icon,
  historyIndex,
}: ToolCallDisplayProps) {
  const hostBridge = useContext(HostBridgeContext);
  const shownContextItems = useMemo(() => {
    const contextItems = toolCallStateToContextItems(toolCallState);
    return contextItems.filter((item) => !item.hidden);
  }, [toolCallState]);

  const isClickable = shownContextItems.length > 0;

  function handleClick() {
    if (shownContextItems.length > 0) {
      openContextItem(shownContextItems[0], hostBridge);
    }
  }
  return (
    <div className="flex flex-col justify-center">
      <div className="mb-1 flex flex-col">
        <div className="agent-activity-row justify-between">
          <div
            className={`agent-activity-row min-w-0 transition-colors duration-200 ease-in-out ${
              isClickable ? "cursor-pointer hover:brightness-125" : ""
            }`}
            onClick={isClickable ? handleClick : undefined}
          >
            {icon && (
              <div className="agent-activity-action-icon flex-shrink-0 font-semibold">
                {icon}
              </div>
            )}
            {tool?.faviconUrl && (
              <img
                src={tool.faviconUrl}
                className="agent-activity-action-icon rounded-sm"
                alt=""
              />
            )}
            <ToolCallStatusMessage tool={tool} toolCallState={toolCallState} />
          </div>
          {!!toolCallState.output?.length && (
            <ToolTruncateHistoryIcon historyIndex={historyIndex} />
          )}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}
