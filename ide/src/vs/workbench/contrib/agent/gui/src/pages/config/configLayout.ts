/** Shared layout tokens for Settings (sidebar + main content). */

export const CONFIG_TOP_INSET = "pt-5";

export const CONFIG_CONTENT_SHELL = [
  "text-foreground text-sm",
  CONFIG_TOP_INSET,
  "px-4 pb-6 md:px-6 md:pb-8",
].join(" ");

/** Narrow column keeps labels and controls visually paired. */
export const CONFIG_CONTENT_MAX_WIDTH = "mx-auto w-full max-w-[34rem]";

export const CONFIG_PAGE_GAP = "flex flex-col gap-4";

/** Stack of major sections (Model, Permissions, …) below the page header. */
export const CONFIG_SECTIONS_STACK = "flex flex-col gap-5";

/** Grouped settings surface — flat inset, no heavy shadow. */
export const CONFIG_PANEL_BORDER =
  "border-[color:var(--vscode-editorWidget-border,var(--vscode-sideBar-border,rgba(128,128,128,0.45)))]";

export const CONFIG_PANEL_SURFACE = [
  "bg-vsc-input-background overflow-hidden rounded-md border border-solid",
  CONFIG_PANEL_BORDER,
].join(" ");

export const CONFIG_PANEL_ROWS = [
  "flex flex-col",
  "divide-y divide-[color:var(--vscode-editorWidget-border,var(--vscode-sideBar-border,rgba(128,128,128,0.32)))]",
  "[&>*]:px-3 [&>*]:py-2.5 sm:[&>*]:px-4",
].join(" ");

export const CONFIG_PANEL_PADDED = "px-3 py-3 sm:px-4 sm:py-3";

export const CONFIG_CARD_STACK = "flex flex-col";

/** Compact numeric field in settings rows. */
export const CONFIG_NUMBER_INPUT =
  "border-[color:var(--vscode-editorWidget-border,var(--vscode-sideBar-border,rgba(128,128,128,0.45)))] bg-vsc-input-background focus-within:border-border-focus focus-within:ring-border-focus flex w-[4.25rem] shrink-0 items-center rounded-md border border-solid focus-within:ring-1";

/** Page title (ConfigHeader default). */
export const CONFIG_PAGE_TITLE =
  "text-lg font-semibold leading-tight tracking-tight text-foreground";

export const CONFIG_PAGE_SUBTITLE =
  "text-description mt-1 max-w-prose text-xs leading-relaxed";

/** Section heading above a panel — sentence case, above row titles in hierarchy. */
export const CONFIG_SECTION_TITLE =
  "text-sm font-semibold leading-none text-foreground";

export const CONFIG_SECTION_DESC =
  "text-description mt-1 max-w-prose text-xs leading-snug";

/** In-card group label (e.g. Agent access radio group). */
export const CONFIG_GROUP_TITLE = "text-[13px] font-semibold text-foreground";

export const CONFIG_GROUP_DESC =
  "text-description mt-0.5 text-xs leading-snug";

/** Row label inside lists (model row, user setting). */
export const CONFIG_ROW_TITLE =
  "text-[13px] font-medium leading-snug text-foreground";

export const CONFIG_ROW_DESC =
  "text-description mt-0.5 text-xs leading-snug";

/** Sidebar nav icon size — keep in sync with ConfigSidebarCell. */
export const CONFIG_NAV_ICON_CLASS = "h-3.5 w-3.5 flex-shrink-0";

/** Fixed row height so icons and labels align across every nav item. */
export const CONFIG_NAV_ROW_HEIGHT = "h-7";

export const CONFIG_SIDEBAR_X = "px-1.5 xl:px-2.5";

/**
 * Icon rail when the Settings webview is narrow (< xl / 720px), e.g. when the
 * Agent panel shares the window. Expanded width fits "VS Code Settings".
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
