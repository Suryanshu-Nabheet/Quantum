import { useMemo, useRef } from "react";
import { useAppSelector } from "../../redux/hooks";

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
 * The full sentence sits above the composer. A tooltip on the toolbar chip
 * lands inside the box and runs off the side of the panel.
 */
export function ContextNotice() {
  const status = useContextStatus();
  if (!status) {
    return null;
  }

  return (
    <p
      className={`mb-1.5 min-w-0 max-w-full px-1 text-[11px] leading-snug ${status.warning ? "text-warning" : "text-description"}`}
      style={{ overflowWrap: "anywhere" }}
    >
      {status.message}
    </p>
  );
}

/**
 * Compact context-usage chip for the composer toolbar.
 * Replaces the old 7×14px fill bar (read as a random red glitch when pruned).
 */
const ContextStatus = () => {
  const status = useContextStatus();
  if (!status) {
    return null;
  }

  const toneClass = status.warning ? "text-warning" : "text-description";

  return (
    <div
      className={`border-command-border inline-flex max-w-[4.5rem] shrink-0 items-center rounded border border-solid px-1 py-0.5 text-[10px] leading-none tabular-nums ${toneClass}`}
      aria-label={status.message}
    >
      <span className="truncate">{status.percent}%</span>
    </div>
  );
};

export default ContextStatus;
