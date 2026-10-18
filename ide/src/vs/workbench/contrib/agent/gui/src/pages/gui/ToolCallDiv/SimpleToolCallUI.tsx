import { Tool, ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { ComponentType, useContext, useMemo, useState } from "react";
import FileIcon from "../../../components/FileIcon";
import {
  ContextItemsPeekItem,
  openContextItem,
} from "../../../components/mainInput/belowMainInput/ContextItemsPeek";
import { HostBridgeContext } from "../../../context/HostBridge";
import { ToggleWithIcon } from "./ToggleWithIcon";
import { ToolCallStatusMessage } from "./ToolCallStatusMessage";
import { ToolTruncateHistoryIcon } from "./ToolTruncateHistoryIcon";
import { toolCallStateToContextItems } from "./utils";

const FILE_TOOLS = new Set<string>([
  BuiltInToolNames.ReadFile,
  BuiltInToolNames.ReadFileRange,
  BuiltInToolNames.ReadCurrentlyOpenFile,
  BuiltInToolNames.CreateNewFile,
]);

function toolOpenTarget(toolCallState: ToolCallState):
  | { path: string; kind: "file" | "dir"; iconName: string }
  | undefined {
  const name = toolCallState.toolCall.function?.name;
  const args = toolCallState.parsedArgs ?? {};
  const processed = toolCallState.processedArgs as
    | { resolvedPath?: { uri?: string; displayPath?: string } }
    | undefined;
  const resolved = processed?.resolvedPath;
  const fromOutput = toolCallState.output?.find((item) => item.uri?.type === "file")
    ?.uri?.value;

  if (name && FILE_TOOLS.has(name)) {
    const display =
      resolved?.displayPath ||
      (typeof args.filepath === "string" ? args.filepath : "");
    const path = fromOutput || resolved?.uri || display;
    if (!path) {
      return undefined;
    }
    return { path, kind: "file", iconName: display || path };
  }

  if (name === BuiltInToolNames.LSTool) {
    const display =
      resolved?.displayPath ||
      (typeof args.dirPath === "string" ? args.dirPath : "");
    const folderName = display.split(/[/\\]/).filter(Boolean).pop() || ".";
    return {
      path: fromOutput || resolved?.uri || display,
      kind: "dir",
      iconName: folderName,
    };
  }

  return undefined;
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
          className={`text-description flex min-w-0 flex-row items-center justify-between gap-1.5 text-xs transition-colors duration-200 ease-in-out ${
            isClickable ? "cursor-pointer hover:brightness-125" : ""
          }`}
          onClick={isClickable ? handleClick : undefined}
          data-testid="context-items-peek"
        >
          <ToggleWithIcon
            icon={target ? undefined : Icon}
            iconNode={
              target ? (
                <FileIcon
                  filename={target.iconName}
                  kind={target.kind === "dir" ? "folder" : "file"}
                  height="16px"
                  width="16px"
                />
              ) : undefined
            }
            isToggleable={isToggleable}
            open={shouldShowContent}
            isClickable={isClickable}
          />
          <ToolCallStatusMessage tool={tool} toolCallState={toolCallState} />
        </div>

        {!!toolCallState.output?.length && (
          <ToolTruncateHistoryIcon historyIndex={historyIndex} />
        )}
      </div>

      {isToggleable && (
        <div
          className={
            shouldShowContent
              ? "mt-2 min-w-0 opacity-100"
              : "mt-2 max-h-0 overflow-hidden opacity-0"
          }
        >
          {shownContextItems.length > 0 ? (
            shownContextItems.map((contextItem, idx) => (
              <ContextItemsPeekItem key={idx} contextItem={contextItem} />
            ))
          ) : (
            <div className="text-description pl-5 text-xs italic">
              No tool call output
            </div>
          )}
        </div>
      )}
    </div>
  );
}
