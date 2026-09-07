import { CHAT_STATUS_LINE_CLASS } from "../../styles/chatLayout";
import { TextShimmer } from "../core/text-shimmer";

interface ShinyLoadingProps {
  status?: string;
}

/**
 * Status line under the last user turn while the agent is working.
 * Shares the same horizontal inset as assistant message text so it reads as
 * the start of the reply column, not a jammed footnote under the composer.
 */
export const ShinyLoading = ({ status }: ShinyLoadingProps) => {
  const displayStatus = status || "Thinking...";

  return (
    <div
      className={`${CHAT_STATUS_LINE_CLASS} animate-in fade-in duration-300`}
      role="status"
      aria-live="polite"
    >
      <TextShimmer duration={2.4}>{displayStatus}</TextShimmer>
    </div>
  );
};
