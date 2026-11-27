import { Tool, ToolCallState } from "core";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "core/tools/builtIn";
import Mustache from "mustache";
import { getStatusIntro } from "./utils";

interface ToolCallStatusMessageProps {
  tool: Tool | undefined;
  toolCallState: ToolCallState;
}

export function ToolCallStatusMessage({
  tool,
  toolCallState,
}: ToolCallStatusMessageProps) {
  if (!tool) return "Agent tool use";

  const toolName = tool.displayTitle ?? tool.function.name;
  const defaultToolDescription = `${toolName} tool`;
  const originalArgs = toolCallState.parsedArgs ?? {};
  const displayArgs = { ...originalArgs };
  const isRead = tool.function.name === BuiltInToolNames.ReadFile || tool.function.name === BuiltInToolNames.ReadFileRange;
  if (isRead && typeof displayArgs.filepath === "string") {
    const path = displayArgs.filepath;
    const name = path.replace(/\\/g, "/").split("/").filter(Boolean).pop() || path;
    const status = toolCallState.status;
    const action = status === "done" ? "Read" : status === "calling" ? "Reading" : status === "errored" || status === "canceled" ? "Tried to read" : "Read";
    return <div className="text-description min-w-0 truncate" data-testid="tool-call-title" title={path}><span>{action} </span><span className="text-foreground font-medium">{name}</span></div>;
  }
  if (tool.group === BUILT_IN_GROUP_NAME) {
    for (const key of ["filepath", "dirPath", "directory_path"]) {
      const path = displayArgs[key];
      if (typeof path === "string") {
        const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
        if (parts.length > 2) displayArgs[key] = `…/${parts.slice(-2).join("/")}`;
      }
    }
  }

  const futureMessage: string = tool.wouldLikeTo
    ? Mustache.render(tool.wouldLikeTo, displayArgs)
    : `use the ${defaultToolDescription}`;
  // to make them more readable

  let intro = getStatusIntro(toolCallState.status, tool.isInstant);
  let message = "";

  // Handle the special case for "done" status or instant tools that are calling
  if (
    toolCallState.status === "done" ||
    (tool.isInstant && toolCallState.status === "calling")
  ) {
    message = tool.hasAlready
      ? Mustache.render(tool.hasAlready, displayArgs)
      : `used the ${defaultToolDescription}`;
  } else {
    switch (toolCallState.status) {
      case "generating":
      case "generated":
      case "canceled":
      case "errored":
        message = futureMessage;
        break;
      case "calling":
        message = tool.isCurrently
          ? Mustache.render(tool.isCurrently, displayArgs)
          : `calling the ${defaultToolDescription}`;
        break;
      default:
        message = defaultToolDescription;
    }
  }

  return (
    <div
      className="text-description line-clamp-4 min-w-0 break-words"
      data-testid="tool-call-title"
      title={Object.keys(displayArgs).some((key) => displayArgs[key] !== originalArgs[key])
        ? `${intro} ${Mustache.render(toolCallState.status === "done" || (tool.isInstant && toolCallState.status === "calling") ? tool.hasAlready ?? "" : toolCallState.status === "calling" ? tool.isCurrently ?? "" : tool.wouldLikeTo ?? "", originalArgs)}`.trim()
        : undefined}
    >
      {`${intro} ${message}`.trim()}
    </div>
  );
}
