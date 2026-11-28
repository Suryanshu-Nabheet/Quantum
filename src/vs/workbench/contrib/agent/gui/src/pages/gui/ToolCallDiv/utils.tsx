import * as Icons from "@heroicons/react/24/outline";
import { ContextItem, ContextItemWithId, ToolCallState } from "core";
import { ComponentType, SVGProps } from "react";
import { BuiltInToolNames } from "core/tools/builtIn";

const FILE_AND_DIRECTORY_TOOLS = new Set<string>([
  BuiltInToolNames.ReadFile,
  BuiltInToolNames.ReadFileRange,
  BuiltInToolNames.ReadCurrentlyOpenFile,
  BuiltInToolNames.CreateNewFile,
  BuiltInToolNames.EditExistingFile,
  BuiltInToolNames.SingleFindAndReplace,
  BuiltInToolNames.MultiEdit,
  BuiltInToolNames.LSTool,
  BuiltInToolNames.ViewSubdirectory,
]);

export function isFileOrDirectoryTool(toolName?: string): boolean {
  return !!toolName && FILE_AND_DIRECTORY_TOOLS.has(toolName);
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
  if (
    toolName === BuiltInToolNames.ViewDiff ||
    toolName === BuiltInToolNames.RunTerminalCommand ||
    isFileOrDirectoryTool(toolName)
  ) {
    return undefined;
  }

  if (configuredIcon) {
    const configured = getIconByName(configuredIcon);
    if (configured) return configured;
  }

  const iconByTool: Record<string, IconName> = {
    [BuiltInToolNames.WebSearch]: "MagnifyingGlassIcon",
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
  return undefined;
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
