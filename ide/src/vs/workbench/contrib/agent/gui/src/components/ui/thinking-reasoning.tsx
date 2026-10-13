import { useEffect, useLayoutEffect, useRef, useState } from "react";
import StyledMarkdownPreview from "../StyledMarkdownPreview";

const styles = {
  tr: "trr-root",
  trHeader: "trr-header",
  isClickable: "trr-clickable",
  trLabel: "trr-label",
  trVerb: "trr-verb",
  trChevron: "trr-chevron",
  isOpen: "trr-open",
  trShimmer: "trr-shimmer",
  trCollapsible: "trr-collapsible",
  isCollapsed: "trr-collapsed",
  trInner: "trr-inner",
  trViewport: "trr-viewport",
  isScroll: "trr-scroll",
  trStream: "trr-stream",
  trSentence: "trr-sentence",
} as const;

const COLLAPSE_BEAT = 360;
const MAX_H = 180;
const FADE = 16;

const REDACTED_LINE = "Thinking content redacted due to safety reasons.";

export interface ThinkingReasoningProps {
  content: string;
  inProgress?: boolean;
  redacted?: boolean;
  contentId?: string;
}

export function ThinkingReasoning({
  content,
  inProgress = false,
  redacted = false,
  contentId,
}: ThinkingReasoningProps) {
  const [settled, setSettled] = useState(!inProgress);
  const [open, setOpen] = useState(false);
  const [elapsedLabel, setElapsedLabel] = useState("");
  const [contentH, setContentH] = useState(0);
  const [fade, setFade] = useState({ top: false, bottom: true });
  const startedAt = useRef<number | null>(inProgress ? Date.now() : null);
  const mountedFinished = useRef(!inProgress);
  const viewportRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<HTMLDivElement>(null);

  const body = redacted ? REDACTED_LINE : content.trim();
  const done = !inProgress && settled;
  const expanded = done ? open : true;
  const capped = contentH > MAX_H;
  const viewH = body.length === 0 ? 0 : capped ? MAX_H : contentH;
  const scrollable = done && open;
  const translate = scrollable ? 0 : capped ? MAX_H - FADE - contentH : 0;
  const showTop = scrollable ? fade.top : capped;
  const showBottom = scrollable ? fade.bottom : capped;
  const mask = capped
    ? `linear-gradient(to bottom, transparent 0, #000 ${showTop ? FADE : 0}px, #000 calc(100% - ${showBottom ? FADE : 0}px), transparent 100%)`
    : "none";

  useEffect(() => {
    if (inProgress) {
      if (startedAt.current == null) {
        startedAt.current = Date.now();
      }
      setSettled(false);
      setOpen(false);
      setElapsedLabel("");
      return;
    }
    if (startedAt.current != null) {
      const seconds = (Date.now() - startedAt.current) / 1000;
      setElapsedLabel(`${Math.max(0.1, seconds).toFixed(1)}s`);
    }
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) {
      setSettled(true);
      return;
    }
    const timer = setTimeout(() => setSettled(true), COLLAPSE_BEAT);
    return () => clearTimeout(timer);
  }, [inProgress]);

  useLayoutEffect(() => {
    const el = streamRef.current;
    if (!el) {
      setContentH(0);
      return;
    }
    const measure = () => setContentH(el.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [content, redacted, expanded]);

  const onScroll = () => {
    const el = viewportRef.current;
    if (!el) {
      return;
    }
    setFade({
      top: el.scrollTop > 1,
      bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 1,
    });
  };

  const toggle = () => {
    const next = !open;
    if (next) {
      setFade({ top: false, bottom: true });
      if (viewportRef.current) {
        viewportRef.current.scrollTop = 0;
      }
    }
    setOpen(next);
  };

  const header = redacted ? (
    <span className={styles.trLabel}>
      <span className={styles.trVerb}>Redacted</span> thinking
    </span>
  ) : done ? (
    <span className={styles.trLabel}>
      <span className={styles.trVerb}>Thought</span>
      {elapsedLabel ? ` for ${elapsedLabel}` : ""}
    </span>
  ) : (
    <span className={`${styles.trLabel} ${styles.trShimmer}`}>Thinking…</span>
  );

  return (
    <div className={`${styles.tr}${mountedFinished.current ? " trr-settled" : ""}`}>
      <button
        type="button"
        className={`${styles.trHeader}${done ? ` ${styles.isClickable}` : ""}`}
        data-testid="thinking-block-peek"
        aria-expanded={expanded}
        aria-controls={contentId}
        aria-label="Toggle thought"
        onClick={done ? toggle : undefined}
      >
        {header}
        {done && (
          <svg
            className={`${styles.trChevron}${expanded ? ` ${styles.isOpen}` : ""}`}
            viewBox="0 0 24 24"
            width="12"
            height="12"
            aria-hidden="true"
          >
            <path
              d="m4.5 15.75 7.5-7.5 7.5 7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      <div
        id={contentId}
        className={`${styles.trCollapsible}${expanded ? "" : ` ${styles.isCollapsed}`}`}
      >
        <div className={styles.trInner}>
          <div
            ref={viewportRef}
            className={`${styles.trViewport}${scrollable ? ` ${styles.isScroll}` : ""}`}
            style={{
              height: `${viewH}px`,
              WebkitMaskImage: mask,
              maskImage: mask,
            }}
            onScroll={scrollable ? onScroll : undefined}
          >
            <div
              ref={streamRef}
              className={styles.trStream}
              style={{ transform: `translateY(${translate}px)` }}
            >
              {body.length > 0 &&
                (redacted ? (
                  <p className={styles.trSentence}>{body}</p>
                ) : (
                  <StyledMarkdownPreview
                    className="trr-markdown"
                    source={body}
                    isThinking
                    isRenderingInStepContainer
                    useParentBackgroundColor
                  />
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ThinkingReasoning;
