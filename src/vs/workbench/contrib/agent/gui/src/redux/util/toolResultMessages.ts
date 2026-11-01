import { ChatMessage } from "core";
import { renderContextItems } from "core/util/messageContent";
import { AppDispatch } from "../store";
import { findToolCallById } from "../util";
import { streamUpdate, ChatHistoryItemWithMessageId } from "../slices/sessionSlice";

export function appendToolResultMessage(
  dispatch: AppDispatch,
  history: ChatHistoryItemWithMessageId[],
  toolCallId: string,
): void {
  const toolCallState = findToolCallById(history, toolCallId);
  if (!toolCallState) {
    return;
  }
  const newMessage: ChatMessage = {
    role: "tool",
    content: renderContextItems(toolCallState.output ?? []),
    toolCallId,
  };
  dispatch(streamUpdate([newMessage]));
}
