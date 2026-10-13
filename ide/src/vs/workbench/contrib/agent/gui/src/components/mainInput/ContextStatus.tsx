import { useMemo, useRef } from "react";
import { useAppSelector } from "../../redux/hooks";
import { ToolTip } from "../gui/Tooltip";

type ContextStatusInfo = {
  percent: number;
  message: string;
  warning: boolean;
};

function useContextStatus(): ContextStatusInfo | null {
  const contextPercentage = useAppSelector(
    (state) => state.session.contextPercentage,
  );
  const selectedChatModel = useAppSelector(
    (state) => state.config.config.selectedModelByRole.chat?.model,
  );
  const previousHistoryLength = useRef<number | null>(null);
  const previousSelectedChatModel = useRef<string | null>(null);
  const history = useAppSelector((state) => state.session.history);
  const percent = Math.round((contextPercentage ?? 0) * 100);
  const isPruned = useAppSelector((state) => state.session.isPruned);

  const isDifferentModelAndSameHistory = useMemo(() => {
    if (!selectedChatModel) return false;
    if (previousHistoryLength.current !== history.length) {
      previousHistoryLength.current = history.length;
      previousSelectedChatModel.current = selectedChatModel;
      return false;
    }
    return previousSelectedChatModel.current !== selectedChatModel;
  }, [history.length, selectedChatModel]);

  if (!isPruned && percent < 60) {
    return null;
  }

  if (isDifferentModelAndSameHistory) {
    return null;
  }

  const warning = isPruned || percent >= 90;
  const message = isPruned
    ? `${percent}% of context filled. Oldest messages are being removed.`
    : `${percent}% of context filled.`;

  return { percent, message, warning };
}

/**
 * Compact context-usage chip for the composer toolbar.
 * The sentence is the hover, not a line above the composer.
 */
const ContextStatus = () => {
  const status = useContextStatus();
  if (!status) {
    return null;
  }

  const toneClass = status.warning ? "text-warning" : "text-description";

  return (
    <ToolTip place="top" content={status.message}>
      <div
        className={`border-command-border inline-flex max-w-[4.5rem] shrink-0 items-center rounded border border-solid px-1 py-0.5 text-[10px] leading-none tabular-nums ${toneClass}`}
        aria-label={status.message}
      >
        <span className="truncate">{status.percent}%</span>
      </div>
    </ToolTip>
  );
};

export default ContextStatus;
