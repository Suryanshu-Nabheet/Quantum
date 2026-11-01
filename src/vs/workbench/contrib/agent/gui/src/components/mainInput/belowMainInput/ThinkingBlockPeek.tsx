import { ChatHistoryItem } from "core";
import ThinkingReasoning from "../../ui/thinking-reasoning";

interface ThinkingBlockPeekProps {
  content: string;
  redactedThinking?: string;
  index: number;
  prevItem: ChatHistoryItem | null;
  inProgress?: boolean;
  signature?: string;
  tokens?: number;
}

function ThinkingBlockPeek({
  content,
  redactedThinking,
  index,
  prevItem,
  inProgress,
}: ThinkingBlockPeekProps) {
  const duplicateRedactedThinkingBlock =
    prevItem &&
    prevItem.message.role === "thinking" &&
    redactedThinking &&
    prevItem.message.redactedThinking;

  if (duplicateRedactedThinkingBlock) {
    return null;
  }

  return (
    <ThinkingReasoning
      content={content}
      inProgress={inProgress}
      redacted={!!redactedThinking}
      contentId={`thinking-block-content-${index}`}
    />
  );
}

export default ThinkingBlockPeek;
