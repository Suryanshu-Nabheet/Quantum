/** Shared layout tokens for Quantum Settings (sidebar + main content). */

export const CONFIG_TOP_INSET = "pt-6";

export const CONFIG_CONTENT_SHELL = [
  "text-foreground text-sm",
  CONFIG_TOP_INSET,
  "px-5 pb-8 md:px-10 md:pb-10",
].join(" ");

export const CONFIG_CONTENT_MAX_WIDTH = "mx-auto w-full max-w-3xl";

export const CONFIG_PAGE_GAP = "flex flex-col gap-6";

export const CONFIG_CARD_STACK = "flex flex-col gap-5";

/** Sidebar nav icon size — keep in sync with ConfigSidebarCell. */
export const CONFIG_NAV_ICON_CLASS = "h-3.5 w-3.5 flex-shrink-0";

/** Fixed row height so icons and labels align across every nav item. */
export const CONFIG_NAV_ROW_HEIGHT = "h-7";

export const CONFIG_SIDEBAR_X = "px-1.5 xl:px-2.5";

/**
 * Icon rail when the Settings webview is narrow (< xl / 720px), e.g. when the
 * Agent panel shares the window. Expanded width fits "Editor Settings".
 */
export const CONFIG_SIDEBAR_WIDTH = "w-11 xl:w-[13.5rem]";

/**
 * Single neutral hairline used for every structural line in Settings — group
 * dividers, card/row borders. Re-exported from shared styles for config call sites.
 */
export {
  HAIRLINE_BORDER as CONFIG_HAIRLINE_BORDER,
  HAIRLINE_DIVIDE as CONFIG_HAIRLINE_DIVIDE,
  HAIRLINE_BORDER_B as CONFIG_HAIRLINE_BORDER_B,
  HAIRLINE_BORDER_T as CONFIG_HAIRLINE_BORDER_T,
} from "../../styles/borders";

/** Soft VS Code–style sidebar edge (not a hard white/high-contrast rule). */
export const CONFIG_SIDEBAR_EDGE =
  "border-0 border-r border-solid border-r-[color:var(--vscode-sideBar-border,rgba(128,128,128,0.22))]";
