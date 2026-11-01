import React, {
  cloneElement,
  isValidElement,
  ReactElement,
  ReactNode,
  useEffect,
  useRef,
} from "react";
import {
  workbenchHoverManager,
  type WorkbenchHoverPlacement,
} from "./WorkbenchHoverHost";

/** Fallback when workbench.hover.delay is not injected yet. */
const DEFAULT_TOOLTIP_DELAY_MS = 500;

let nextHoverId = 1;

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
  const hoverIdRef = useRef(0);
  if (hoverIdRef.current === 0) {
    hoverIdRef.current = nextHoverId++;
  }

  useEffect(() => {
    const hoverId = hoverIdRef.current;
    return () => {
      if (showTimeoutRef.current !== undefined) {
        clearTimeout(showTimeoutRef.current);
      }
      workbenchHoverManager.hide(hoverId);
    };
  }, []);

  if (isEmptyContent(content)) {
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
    const hoverId = hoverIdRef.current;
    showTimeoutRef.current = setTimeout(() => {
      // A portaled menu is not a DOM child, so a parent tip can outlive the
      // pointer. Only open if the pointer is still on this anchor.
      if (!isHoveringRef.current || !target.isConnected || !target.matches(":hover")) {
        return;
      }
      workbenchHoverManager.show(
        hoverId,
        content,
        target.getBoundingClientRect(),
        normalizePlacement(place),
      );
    }, delay);
  };

  const handleMouseEnter = (event: React.MouseEvent<HTMLElement>) => {
    // A nested tip (warning icon inside a labeled control) owns this hover.
    event.stopPropagation();
    if (isHoveringRef.current) {
      return;
    }
    isHoveringRef.current = true;
    scheduleShow(event.currentTarget);
  };

  const handleMouseLeave = (event: React.MouseEvent<HTMLElement>) => {
    const related = event.relatedTarget;
    if (related instanceof Node && event.currentTarget.contains(related)) {
      return;
    }
    isHoveringRef.current = false;
    clearShowTimeout();
    workbenchHoverManager.hide(hoverIdRef.current);
  };

  if (!isValidElement(children)) {
    return children;
  }

  const childProps = children.props as {
    onMouseEnter?: (event: React.MouseEvent<HTMLElement>) => void;
    onMouseLeave?: (event: React.MouseEvent<HTMLElement>) => void;
  };

  return cloneElement(children, {
    onMouseEnter: mergeHandlers(childProps.onMouseEnter, handleMouseEnter),
    onMouseLeave: mergeHandlers(childProps.onMouseLeave, handleMouseLeave),
  } as React.HTMLAttributes<HTMLElement>);
}
