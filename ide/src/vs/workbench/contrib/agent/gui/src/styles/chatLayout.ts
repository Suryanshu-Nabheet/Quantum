/**
 * Shared Agent chat column spacing.
 * One scale: 10px between turns, 6px inside a turn, 4px between tool rows.
 * Clearance under the last line lives on the scroll container, not this stack.
 */

/** Outer chat column (messages + composer). */
export const CHAT_SURFACE_CLASS = [
  "box-border w-full min-w-0",
  "px-3 pb-3 sm:px-4",
].join(" ");

/** Shared content inset. Matches the composer text (`px-2`). */
const CHAT_MESSAGE_INSET_CLASS = "px-2";

/** Vertical gap between history turns. No top padding — the first line stays flush. */
export const CHAT_HISTORY_STACK_CLASS =
  "flex w-full min-w-0 max-w-full flex-col gap-2.5";

/** Spacing inside a single assistant turn (message + tools). */
export const CHAT_TURN_GAP_CLASS =
  "flex w-full min-w-0 max-w-full flex-col gap-1.5";

/** Streaming / tool status line under the last user bubble. */
export const CHAT_STATUS_LINE_CLASS = [
  "text-description flex min-h-[1.125rem] items-center",
  "mt-1 mb-0",
  CHAT_MESSAGE_INSET_CLASS,
  "select-none",
].join(" ");

/** Assistant message body wrapper. */
export const CHAT_ASSISTANT_BODY_CLASS = [
  "bg-background min-w-0 max-w-full",
  CHAT_MESSAGE_INSET_CLASS,
].join(" ");

/** Tool-call stack under an assistant turn. */
export const CHAT_TOOL_STACK_CLASS = "flex flex-col gap-1";

/** Single tool-call row. */
export const CHAT_TOOL_ROW_CLASS = ["min-w-0", CHAT_MESSAGE_INSET_CLASS].join(
  " ",
);
