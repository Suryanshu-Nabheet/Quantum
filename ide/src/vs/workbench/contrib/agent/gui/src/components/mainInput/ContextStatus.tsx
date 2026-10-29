import { useMemo, useRef } from "react";
import { useAppSelector } from "../../redux/hooks";
import { ToolTip } from "../gui/Tooltip";

type ContextStatusInfo = {
  percent: number;
  loadedTokens: number;
  inputTokens: number;
  outputTokens?: number;
  outputIsEstimated: boolean;
  contextLength: number;
  warning: boolean;
};

function formatCompactTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(tokens >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(tokens >= 10_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  }
  return tokens.toLocaleString();
}

function useContextStatus(): ContextStatusInfo | null {
  const contextUsage = useAppSelector((state) => state.session.contextUsage);
  const outputTokens = useAppSelector(
    (state) => state.session.contextOutputTokens,
  );
  const outputIsEstimated = useAppSelector(
    (state) => state.session.contextOutputIsEstimated ?? false,
  );
  const selectedChatModel = useAppSelector(
    (state) => state.config.config.selectedModelByRole.chat?.model,
  );
  const previousHistoryLength = useRef<number | null>(null);
  const previousSelectedChatModel = useRef<string | null>(null);
  const history = useAppSelector((state) => state.session.history);
  const isPruned = useAppSelector((state) => state.session.isPruned);

  const isDifferentModelAndSameHistory = useMemo(() => {
    if (!selectedChatModel) {
      return false;
    }
    if (previousHistoryLength.current !== history.length) {
      previousHistoryLength.current = history.length;
      previousSelectedChatModel.current = selectedChatModel;
      return false;
    }
    return previousSelectedChatModel.current !== selectedChatModel;
  }, [history.length, selectedChatModel]);

  if (
    !contextUsage ||
    !Number.isFinite(contextUsage.inputTokens) ||
    !Number.isFinite(contextUsage.contextLength) ||
    contextUsage.contextLength <= 0 ||
    isDifferentModelAndSameHistory
  ) {
    return null;
  }

  const loadedTokens = contextUsage.inputTokens + (outputTokens ?? 0);
  const percent = (loadedTokens / contextUsage.contextLength) * 100;

  return {
    percent,
    loadedTokens,
    inputTokens: contextUsage.inputTokens,
    outputTokens,
    outputIsEstimated,
    contextLength: contextUsage.contextLength,
    warning: isPruned || percent >= 90,
  };
}

function ContextUsageTooltip({ status }: { status: ContextStatusInfo }) {
  const progress = Math.min(100, Math.max(0, status.percent));
  const percentLabel = `${status.percent.toFixed(1)}%`;
  const outputLabel =
    status.outputTokens === undefined
      ? "Pending"
      : `${status.outputTokens.toLocaleString()} tokens${status.outputIsEstimated ? " (estimated)" : ""}`;

  return (
    <div className="w-56 space-y-2 px-1 py-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium">{percentLabel}</span>
        <span className="text-description-muted tabular-nums">
          {formatCompactTokenCount(status.loadedTokens)} / {formatCompactTokenCount(status.contextLength)}
        </span>
      </div>
      <div
        className="bg-vsc-input-background h-1.5 overflow-hidden rounded-full"
        role="progressbar"
        aria-label="Context window used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
      >
        <div
          className={`h-full rounded-full ${status.warning ? "bg-warning" : "bg-border-focus"}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="border-command-border space-y-1 border-t border-solid pt-2">
        <div className="flex justify-between gap-4">
          <span className="text-description-muted">Input</span>
          <span className="tabular-nums">{status.inputTokens.toLocaleString()} tokens</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-description-muted">Output</span>
          <span className="tabular-nums">{outputLabel}</span>
        </div>
        <div className="flex justify-between gap-4 font-medium">
          <span>Loaded context</span>
          <span className="tabular-nums">
            {status.loadedTokens.toLocaleString()} / {status.contextLength.toLocaleString()}
          </span>
        </div>
      </div>
      <div className="text-description-muted text-[11px] leading-snug">
        Input is counted from the assembled prompt. Output uses provider usage when available and a model tokenizer estimate otherwise.
      </div>
    </div>
  );
}

/** Compact context usage and model-window details for the composer toolbar. */
const ContextStatus = () => {
  const status = useContextStatus();
  if (!status) {
    return null;
  }

  const progress = Math.min(100, Math.max(0, status.percent));
  const toneClass = status.warning ? "text-warning" : "text-description";
  const accessibleLabel = `${status.percent.toFixed(1)} percent of context used. ${status.loadedTokens.toLocaleString()} of ${status.contextLength.toLocaleString()} tokens loaded.`;

  return (
    <ToolTip
      place="top"
      content={<ContextUsageTooltip status={status} />}
    >
      <div
        className={`border-command-border inline-flex shrink-0 items-center gap-1 rounded border border-solid px-1.5 py-0.5 text-[10px] leading-none tabular-nums ${toneClass}`}
        aria-label={accessibleLabel}
        role="img"
      >
        <span>{status.percent.toFixed(1)}%</span>
        <svg
          className="h-3.5 w-3.5 -rotate-90"
          viewBox="0 0 16 16"
          aria-hidden="true"
        >
          <circle
            cx="8"
            cy="8"
            r="6"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.25"
            strokeWidth="2"
          />
          <circle
            cx="8"
            cy="8"
            r="6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray={2 * Math.PI * 6}
            strokeDashoffset={2 * Math.PI * 6 * (1 - progress / 100)}
          />
        </svg>
        <span className="text-description-muted">
          {formatCompactTokenCount(status.loadedTokens)}/{formatCompactTokenCount(status.contextLength)}
        </span>
      </div>
    </ToolTip>
  );
};

export default ContextStatus;
