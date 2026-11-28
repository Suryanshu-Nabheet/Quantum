import { Tool, ToolCallState } from "core";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "core/tools/builtIn";
import Mustache from "mustache";
import { ActivityLabel } from "../../../components/ui/ActivityLabel";
import { isFileOrDirectoryTool } from "./utils";

interface ToolCallStatusMessageProps {
  tool: Tool | undefined;
  toolCallState: ToolCallState;
}

function basename(path: string): string {
  const name = path.replace(/\\/g, "/").split("/").filter(Boolean).pop();
  return name && name !== "." && name !== ".." ? name : "workspace";
}

function getFileAction(
  toolName: string,
  status: ToolCallState["status"],
  isInstant: boolean,
) {
  const isRead =
    toolName === BuiltInToolNames.ReadFile ||
    toolName === BuiltInToolNames.ReadFileRange ||
    toolName === BuiltInToolNames.ReadCurrentlyOpenFile;
  const isList =
    toolName === BuiltInToolNames.LSTool ||
    toolName === BuiltInToolNames.ViewSubdirectory;
  const past = isRead
    ? "Read"
    : isList
      ? "Listed"
      : isCreate(toolName)
        ? "Created"
        : isEdit(toolName)
          ? "Edited"
          : "Used";
  const present = isRead
    ? "Reading"
    : isList
      ? "Listing"
      : isCreate(toolName)
        ? "Creating"
        : isEdit(toolName)
          ? "Editing"
          : "Using";
  const base = isRead
    ? "Read"
    : isList
      ? "List"
      : isCreate(toolName)
        ? "Create"
        : isEdit(toolName)
          ? "Edit"
          : "Use";

  if (status === "calling" && !isInstant) {
    return present;
  }
  if (status === "done" || (status === "calling" && isInstant)) {
    return past;
  }
  return base;
}

function isCreate(toolName: string): boolean {
  return toolName === BuiltInToolNames.CreateNewFile;
}

function isEdit(toolName: string): boolean {
  return (
    toolName === BuiltInToolNames.EditExistingFile ||
    toolName === BuiltInToolNames.SingleFindAndReplace ||
    toolName === BuiltInToolNames.MultiEdit
  );
}

function getFailedAction(toolName: string): string {
  switch (toolName) {
    case BuiltInToolNames.ReadFile:
    case BuiltInToolNames.ReadFileRange:
      return "Read file";
    case BuiltInToolNames.ReadCurrentlyOpenFile:
      return "Read current file";
    case BuiltInToolNames.LSTool:
    case BuiltInToolNames.ViewSubdirectory:
      return "List files";
    case BuiltInToolNames.CreateNewFile:
      return "Create file";
    case BuiltInToolNames.EditExistingFile:
    case BuiltInToolNames.SingleFindAndReplace:
    case BuiltInToolNames.MultiEdit:
      return "Edit file";
    case BuiltInToolNames.RunTerminalCommand:
      return "Run command";
    case BuiltInToolNames.GrepSearch:
      return "Search files";
    case BuiltInToolNames.WebSearch:
      return "Search the web";
    case BuiltInToolNames.FileGlobSearch:
      return "Find files";
    case BuiltInToolNames.ViewDiff:
      return "View git diff";
    case BuiltInToolNames.WriteTodos:
      return "Update tasks";
    case BuiltInToolNames.CreatePlan:
      return "Create plan";
    case BuiltInToolNames.ReadSkill:
      return "Read skill";
    case BuiltInToolNames.CreateRuleBlock:
      return "Create rule";
    case BuiltInToolNames.RequestRule:
      return "Request rule";
    default:
      return "Run tool";
  }
}

function removeStatusLead(message: string): string {
  return message.replace(/^(?:will|wants to|is|tried to)\s+/i, "");
}

export function ToolCallStatusMessage({
  tool,
  toolCallState,
}: ToolCallStatusMessageProps) {
  const toolFunctionName =
    tool?.function.name ?? toolCallState.toolCall.function?.name;
  if (!toolFunctionName) {
    return (
      <ActivityLabel
        text="Used tool"
        status={toolCallState.status === "errored" ? "Failed" : toolCallState.status === "canceled" ? "Canceled" : undefined}
      />
    );
  }

  const originalArgs = toolCallState.parsedArgs ?? {};

  if (toolCallState.status === "errored") {
    return (
      <ActivityLabel
        text={getFailedAction(toolFunctionName)}
        status="Failed"
      />
    );
  }

  if (isFileOrDirectoryTool(toolFunctionName)) {
    const pathKeys =
      toolFunctionName === BuiltInToolNames.LSTool
        ? ["dirPath"]
        : toolFunctionName === BuiltInToolNames.ViewSubdirectory
          ? ["directory_path"]
          : ["filepath"];
    const path = pathKeys
      .map((key) => originalArgs[key])
      .find((value): value is string => typeof value === "string" && value.length > 0);
    const isReadCurrentFile =
      toolFunctionName === BuiltInToolNames.ReadCurrentlyOpenFile;
    const detail = path ? basename(path) : isReadCurrentFile ? "current file" : "";
    const action = getFileAction(
      toolFunctionName,
      toolCallState.status,
      tool?.isInstant ?? false,
    );
    const label = [action, detail].filter(Boolean).join(" ");

    return (
      <span
        className="text-description min-w-0 truncate"
        data-testid="tool-call-title"
        title={detail || undefined}
      >
        <ActivityLabel text={label} status={toolCallState.status === "canceled" ? "Canceled" : undefined} />
      </span>
    );
  }

  if (!tool) {
    const readableName = toolFunctionName
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const action =
      toolCallState.status === "done"
        ? "Used"
        : toolCallState.status === "calling"
          ? "Using"
          : "Use";
    return (
      <ActivityLabel
        text={`${action} ${readableName || "tool"}`}
        status={toolCallState.status === "canceled" ? "Canceled" : undefined}
      />
    );
  }

  const toolName = tool.displayTitle ?? tool.function.name;

  const displayArgs = { ...originalArgs };
  if (tool.group === BUILT_IN_GROUP_NAME) {
    for (const key of ["filepath", "dirPath", "directory_path"]) {
      const path = displayArgs[key];
      if (typeof path === "string") {
        displayArgs[key] = basename(path);
      }
    }
  }

  const defaultToolDescription = `${toolName} tool`;
  const requestedAction = tool.wouldLikeTo
    ? Mustache.render(tool.wouldLikeTo, displayArgs)
    : `use the ${defaultToolDescription}`;
  let message: string;

  if (toolCallState.status === "done" || (tool.isInstant && toolCallState.status === "calling")) {
    message = tool.hasAlready
      ? Mustache.render(tool.hasAlready, displayArgs)
      : `used the ${defaultToolDescription}`;
  } else {
    switch (toolCallState.status) {
      case "calling":
        message = tool.isCurrently
          ? removeStatusLead(Mustache.render(tool.isCurrently, displayArgs))
          : `using the ${defaultToolDescription}`;
        break;
      case "generating":
      case "generated":
        message = removeStatusLead(requestedAction);
        break;
      case "canceled":
        message = removeStatusLead(requestedAction);
        break;
      default:
        message = defaultToolDescription;
    }
  }

  return (
    <span className="text-description min-w-0 truncate" data-testid="tool-call-title">
      <ActivityLabel text={message} status={toolCallState.status === "canceled" ? "Canceled" : undefined} />
    </span>
  );
}
