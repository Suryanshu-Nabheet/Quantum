/**
 * Shared Agent chat column spacing.
 * Keep status / message / tools on one inset — gaps stay tight so tool batches
 * don't leave empty bands between turns.
 */

/** Outer chat column (messages + composer). */
export const CHAT_SURFACE_CLASS = [
  "box-border w-full min-w-0",
  "px-3 pb-3 sm:px-4",
].join(" ");

/** Shared content inset inside the chat column. */
const CHAT_MESSAGE_INSET_CLASS = "px-1 sm:px-1.5";

/** Vertical gap between history turns. */
export const CHAT_HISTORY_STACK_CLASS = "flex flex-col gap-1";

/** Spacing inside a single assistant turn (message + tools). */
export const CHAT_TURN_GAP_CLASS = "flex flex-col gap-0.5";

/** Streaming / tool status line under the last user bubble. */
export const CHAT_STATUS_LINE_CLASS = [
  "text-description flex min-h-[1.125rem] items-center",
  "mt-1 mb-0",
  CHAT_MESSAGE_INSET_CLASS,
  "text-xs leading-4",
  "select-none",
].join(" ");

/** Assistant message body wrapper. */
export const CHAT_ASSISTANT_BODY_CLASS = [
  "bg-background min-w-0 max-w-full",
  CHAT_MESSAGE_INSET_CLASS,
].join(" ");

/** Tool-call stack under an assistant turn. */
export const CHAT_TOOL_STACK_CLASS = "flex flex-col gap-0.5";

/** Single tool-call row. */
export const CHAT_TOOL_ROW_CLASS = ["min-w-0", CHAT_MESSAGE_INSET_CLASS].join(
  " ",
);
