import * as Icons from "@heroicons/react/24/outline";
import {
  ContextItem,
  ContextItemWithId,
  ToolCallState,
} from "core";
import { ComponentType, SVGProps } from "react";
import { BuiltInToolNames } from "core/tools/builtIn";

// Helper function to determine the intro verb based on tool call status
export function getStatusIntro(
  status: ToolCallState["status"],
  isInstant?: boolean,
): string {
  if (status === "done" || (isInstant && status === "calling")) {
    return "";
  }

  switch (status) {
    case "generating":
      return "will";
    case "generated":
      return "wants to";
    case "calling":
      return "is";
    case "canceled":
    case "errored":
      return "tried to";
    default:
      return "";
  }
}

// Helper function to get the appropriate verb for group actions
export function getGroupActionVerb(toolCallStates: ToolCallState[]): string {
  if (toolCallStates.length === 0) return "Performing";

  // Get the most "active" status from all tool calls
  const statuses = toolCallStates.map((state) => state.status);

  // Priority order: calling > generating > generated > done > errored/canceled
  if (statuses.includes("calling")) {
    return "Performing";
  } else if (statuses.includes("generating")) {
    return "Generating";
  } else if (statuses.includes("generated")) {
    return "Pending";
  } else if (statuses.some((s) => s === "done")) {
    return "Performed";
  } else if (statuses.some((s) => s === "errored" || s === "canceled")) {
    return "Attempted";
  }

  return "Performing";
}

type IconName = keyof typeof Icons;

type Icon = ComponentType<SVGProps<SVGSVGElement>> | undefined;

export function getIconByName(name: string): Icon | null {
  if (name in Icons) {
    return Icons[name as IconName] as Icon;
  }
  return null;
}

export function getToolCallIcon(
  toolName?: string,
  group?: string,
  configuredIcon?: string,
): Icon {
  if (configuredIcon) {
    const configured = getIconByName(configuredIcon);
    if (configured) return configured;
  }

  const iconByTool: Record<string, IconName> = {
    [BuiltInToolNames.ReadFile]: "DocumentIcon",
    [BuiltInToolNames.ReadFileRange]: "DocumentTextIcon",
    [BuiltInToolNames.ReadCurrentlyOpenFile]: "DocumentTextIcon",
    [BuiltInToolNames.CreateNewFile]: "DocumentPlusIcon",
    [BuiltInToolNames.EditExistingFile]: "PencilSquareIcon",
    [BuiltInToolNames.SingleFindAndReplace]: "MagnifyingGlassIcon",
    [BuiltInToolNames.MultiEdit]: "PencilSquareIcon",
    [BuiltInToolNames.RunTerminalCommand]: "CommandLineIcon",
    [BuiltInToolNames.GrepSearch]: "MagnifyingGlassIcon",
    [BuiltInToolNames.FileGlobSearch]: "MagnifyingGlassIcon",
    [BuiltInToolNames.ViewDiff]: "CodeBracketIcon",
    [BuiltInToolNames.LSTool]: "FolderIcon",
    [BuiltInToolNames.CreateRuleBlock]: "PencilIcon",
    [BuiltInToolNames.RequestRule]: "DocumentMagnifyingGlassIcon",
    [BuiltInToolNames.ReadSkill]: "BookOpenIcon",
    [BuiltInToolNames.WriteTodos]: "ListBulletIcon",
    [BuiltInToolNames.CreatePlan]: "ClipboardDocumentListIcon",
    open_browser_page: "GlobeAltIcon",
    list_open_pages: "RectangleStackIcon",
    close_browser_page: "GlobeAltIcon",
    read_page: "DocumentTextIcon",
    screenshot_page: "CameraIcon",
    navigate_page: "GlobeAltIcon",
    click_element: "CursorArrowRaysIcon",
    type_in_page: "PencilSquareIcon",
    hover_element: "EyeIcon",
    drag_element: "ArrowsPointingOutIcon",
    run_playwright_code: "CodeBracketIcon",
    handle_dialog: "ChatBubbleLeftRightIcon",
  };

  const iconName = toolName ? iconByTool[toolName] : undefined;
  if (iconName) return getIconByName(iconName) ?? undefined;

  const normalizedGroup = group?.toLowerCase() ?? "";
  if (normalizedGroup.includes("browser")) {
    return getIconByName("GlobeAltIcon") ?? undefined;
  }
  if (normalizedGroup.includes("mcp")) {
    return getIconByName("PuzzlePieceIcon") ?? undefined;
  }
  return getIconByName("WrenchScrewdriverIcon") ?? undefined;
}

export function toolCallStateToContextItems(
  toolCallState: ToolCallState | undefined,
): ContextItemWithId[] {
  if (!toolCallState) {
    return [];
  }
  return (
    toolCallState.output?.map((ctxItem) =>
      toolCallCtxItemToCtxItemWithId(ctxItem, toolCallState.toolCallId),
    ) ?? []
  );
}

export function toolCallCtxItemToCtxItemWithId(
  ctxItem: ContextItem,
  toolCallId: string,
): ContextItemWithId {
  return {
    ...ctxItem,
    id: {
      providerTitle: "toolCall",
      itemId: toolCallId,
    },
  };
}
