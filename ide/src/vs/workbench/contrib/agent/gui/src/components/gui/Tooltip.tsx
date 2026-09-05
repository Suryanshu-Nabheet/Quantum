import React, {
  cloneElement,
  isValidElement,
  ReactElement,
  ReactNode,
  useRef,
} from "react";
import {
  workbenchHoverManager,
  type WorkbenchHoverPlacement,
} from "./WorkbenchHoverHost";

/** Fallback when workbench.hover.delay is not injected yet. */
const DEFAULT_TOOLTIP_DELAY_MS = 500;

export type TooltipPlacement =
  | WorkbenchHoverPlacement
  | "top-end"
  | "top-start"
  | "bottom-end"
  | "bottom-start"
  | "left-end"
  | "right-end";

function normalizePlacement(place: TooltipPlacement): WorkbenchHoverPlacement {
  if (place.startsWith("top")) {
    return "top";
  }
  if (place.startsWith("bottom")) {
    return "bottom";
  }
  if (place.startsWith("left")) {
    return "left";
  }
  return "right";
}

declare global {
  interface Window {
    workbenchHoverDelay?: number;
  }
}

function isEmptyContent(content: ReactNode): boolean {
  return content === null || content === undefined || content === "";
}

function extractTooltipText(content: ReactNode): string | undefined {
  if (typeof content === "string" || typeof content === "number") {
    return String(content);
  }
  if (isValidElement(content)) {
    const child = content.props.children;
    if (typeof child === "string" || typeof child === "number") {
      return String(child);
    }
  }
  return undefined;
}

function mergeHandlers<E>(
  existing: ((event: E) => void) | undefined,
  next: (event: E) => void,
): (event: E) => void {
  return (event) => {
    existing?.(event);
    next(event);
  };
}

export function ToolTip({
  content,
  children,
  place = "top",
  delayShow,
  // Legacy react-tooltip props — ignored.
  id: _id,
  style: _style,
  className: _className,
  clickable: _clickable,
  closeEvents: _closeEvents,
  ..._rest
}: {
  content: ReactNode;
  children: ReactElement;
  place?: TooltipPlacement;
  id?: string;
  delayShow?: number;
  style?: React.CSSProperties;
  className?: string;
  clickable?: boolean;
  closeEvents?: Record<string, boolean>;
}) {
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>();
  const isHoveringRef = useRef(false);

  if (isEmptyContent(content)) {
    return children;
  }

  const tooltipText = extractTooltipText(content);
  if (!tooltipText) {
    return children;
  }

  const delay =
    delayShow ??
    window.workbenchHoverDelay ??
    DEFAULT_TOOLTIP_DELAY_MS;

  const clearShowTimeout = () => {
    if (showTimeoutRef.current !== undefined) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = undefined;
    }
  };

  const scheduleShow = (target: HTMLElement) => {
    clearShowTimeout();
    showTimeoutRef.current = setTimeout(() => {
      workbenchHoverManager.show(
        tooltipText,
        target.getBoundingClientRect(),
        normalizePlacement(place),
      );
    }, delay);
  };

  const handleMouseOverCapture = (event: React.MouseEvent<HTMLElement>) => {
    if (isHoveringRef.current) {
      return;
    }
    isHoveringRef.current = true;
    scheduleShow(event.currentTarget);
  };

  const handleMouseOutCapture = (event: React.MouseEvent<HTMLElement>) => {
    const related = event.relatedTarget as Node | null;
    if (related && event.currentTarget.contains(related)) {
      return;
    }
    isHoveringRef.current = false;
    clearShowTimeout();
    workbenchHoverManager.hide();
  };

  if (!isValidElement(children)) {
    return children;
  }

  const childProps = children.props as {
    onMouseOverCapture?: (event: React.MouseEvent<HTMLElement>) => void;
    onMouseOutCapture?: (event: React.MouseEvent<HTMLElement>) => void;
  };

  return cloneElement(children, {
    onMouseOverCapture: mergeHandlers(
      childProps.onMouseOverCapture,
      handleMouseOverCapture,
    ),
    onMouseOutCapture: mergeHandlers(
      childProps.onMouseOutCapture,
      handleMouseOutCapture,
    ),
  } as React.HTMLAttributes<HTMLElement>);
}
