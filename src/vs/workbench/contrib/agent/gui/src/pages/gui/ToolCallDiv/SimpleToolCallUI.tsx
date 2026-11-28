import { Tool, ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { ComponentType, useContext, useMemo, useState } from "react";
import {
  ContextItemsPeekItem,
  openContextItem,
} from "../../../components/mainInput/belowMainInput/ContextItemsPeek";
import { ActivityChevron } from "../../../components/ui/ActivityChevron";
import { HostBridgeContext } from "../../../context/HostBridge";
import { ToolCallStatusMessage } from "./ToolCallStatusMessage";
import { ToolTruncateHistoryIcon } from "./ToolTruncateHistoryIcon";
import { isFileOrDirectoryTool, toolCallStateToContextItems } from "./utils";
import { CHAT_UI_TEXT_CLASS } from "../../../styles/chatLayout";

function toolOpenTarget(toolCallState: ToolCallState):
  | { path: string; kind: "file" | "dir" }
  | undefined {
  const name = toolCallState.toolCall.function?.name;
  const args = toolCallState.parsedArgs ?? {};
  const processed = toolCallState.processedArgs as
    | { resolvedPath?: { uri?: string; displayPath?: string } }
    | undefined;
  const resolved = processed?.resolvedPath;
  const fromOutput = toolCallState.output?.find((item) => item.uri?.type === "file")
    ?.uri?.value;

  if (!name || !isFileOrDirectoryTool(name)) {
    return undefined;
  }

  const isDirectory =
    name === BuiltInToolNames.LSTool ||
    name === BuiltInToolNames.ViewSubdirectory;
  const sourcePath = isDirectory
    ? name === BuiltInToolNames.LSTool
      ? args.dirPath
      : args.directory_path
    : args.filepath;
  const display =
    resolved?.displayPath ||
    (typeof sourcePath === "string" ? sourcePath : "");
  const path = fromOutput || resolved?.uri || display;

  return path ? { path, kind: isDirectory ? "dir" : "file" } : undefined;
}

interface SimpleToolCallUIProps {
  toolCallState: ToolCallState;
  tool: Tool | undefined;
  icon?: ComponentType<React.SVGProps<SVGSVGElement>>;
  historyIndex: number;
}

export function SimpleToolCallUI({
  icon: Icon,
  toolCallState,
  tool,
  historyIndex,
}: SimpleToolCallUIProps) {
  const hostBridge = useContext(HostBridgeContext);
  const shownContextItems = useMemo(() => {
    const contextItems = toolCallStateToContextItems(toolCallState);
    return contextItems.filter((item) => !item.hidden);
  }, [toolCallState]);

  const [open, setOpen] = useState(false);
  const target = useMemo(
    () => toolOpenTarget(toolCallState),
    [toolCallState],
  );

  const isToggleable = shownContextItems.length > 1 && target?.kind !== "file";
  const isSingleItem = shownContextItems.length === 1;
  const shouldShowContent = isToggleable ? open : false;
  const isClickable = isToggleable || isSingleItem || target?.kind === "file";

  function handleClick() {
    if (target?.kind === "file" && target.path) {
      hostBridge.post("openFile", { path: target.path });
      return;
    }
    if (isToggleable) {
      setOpen((prev) => !prev);
    } else if (isSingleItem) {
      openContextItem(shownContextItems[0], hostBridge);
    }
  }

  return (
    <div className="flex flex-col">
      <div className="flex min-w-0 flex-row items-center justify-between gap-2">
        <div
          className={`agent-activity-row text-description flex min-w-0 ${CHAT_UI_TEXT_CLASS} transition-colors duration-200 ease-in-out ${
            isClickable ? "cursor-pointer hover:brightness-125" : ""
          }`}
          onClick={isClickable ? handleClick : undefined}
          role={isClickable ? "button" : undefined}
          tabIndex={isClickable ? 0 : undefined}
          onKeyDown={isClickable ? (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleClick();
            }
          } : undefined}
          data-testid="context-items-peek"
        >
          {!target && Icon && <Icon aria-hidden="true" focusable="false" className="agent-activity-action-icon text-description" />}
          <ToolCallStatusMessage tool={tool} toolCallState={toolCallState} />
          {isToggleable && <ActivityChevron open={shouldShowContent} />}
        </div>

        {!!toolCallState.output?.length && (
          <ToolTruncateHistoryIcon historyIndex={historyIndex} />
        )}
      </div>

      {isToggleable && (
        <div
          className={`agent-activity-collapsible${shouldShowContent ? "" : " agent-activity-collapsed"}`}
          aria-hidden={!shouldShowContent}
        >
          <div className="agent-activity-disclosure-inner">
            <div className="mt-2 min-w-0">
              {shownContextItems.length > 0 ? (
                shownContextItems.map((contextItem, idx) => (
                  <ContextItemsPeekItem key={idx} contextItem={contextItem} />
                ))
              ) : (
                <div className={`text-description pl-5 ${CHAT_UI_TEXT_CLASS} italic`}>
                  No tool call output
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
