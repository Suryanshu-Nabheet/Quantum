import { useMemo, useRef } from "react";
import { useAppSelector } from "../../redux/hooks";
import { ToolTip } from "../gui/Tooltip";

/**
 * Compact context-usage chip for the composer toolbar.
 * Replaces the old 7×14px fill bar (read as a random red glitch when pruned).
 */
const ContextStatus = () => {
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

  const toneClass =
    isPruned || percent >= 90 ? "text-warning" : "text-description";

  const tooltip = isPruned
    ? `${percent}% of context filled. Oldest messages are being removed.`
    : `${percent}% of context filled.`;

  return (
    <ToolTip place="top" content={tooltip}>
      <div
        className={`border-command-border inline-flex max-w-[4.5rem] shrink-0 items-center rounded border border-solid px-1 py-0.5 text-[10px] leading-none tabular-nums ${toneClass}`}
        aria-label={tooltip}
      >
        <span className="truncate">{percent}%</span>
      </div>
    </ToolTip>
  );
};

export default ContextStatus;
