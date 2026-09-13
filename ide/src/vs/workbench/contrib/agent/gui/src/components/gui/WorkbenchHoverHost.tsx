import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSyncExternalStore } from "react";

export type WorkbenchHoverPlacement = "top" | "bottom" | "left" | "right";

type HoverState = {
  content: string;
  anchor: DOMRect;
  placement: WorkbenchHoverPlacement;
} | null;

type Listener = (state: HoverState) => void;

const POINTER_GAP = 6;
const VIEWPORT_PAD = 8;

class WorkbenchHoverManager {
  private state: HoverState = null;
  private listeners = new Set<Listener>();

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): HoverState => this.state;

  show(content: string, anchor: DOMRect, placement: WorkbenchHoverPlacement) {
    this.state = { content, anchor, placement };
    this.emit();
  }

  hide() {
    if (!this.state) {
      return;
    }
    this.state = null;
    this.emit();
  }

  private emit() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

export const workbenchHoverManager = new WorkbenchHoverManager();

function getHoverPosition(
  anchor: DOMRect,
  hoverWidth: number,
  hoverHeight: number,
  placement: WorkbenchHoverPlacement,
  viewportWidth: number,
  viewportHeight: number,
): { left: number; top: number; pointerClass: string } {
  const centerX = anchor.left + anchor.width / 2;
  const centerY = anchor.top + anchor.height / 2;

  let left: number;
  let top: number;
  let pointerClass: string;
  let effectivePlacement = placement;

  // Prefer the opposite side when the preferred placement would leave too little room.
  if (
    placement === "bottom" &&
    anchor.bottom + POINTER_GAP + hoverHeight > viewportHeight - VIEWPORT_PAD &&
    anchor.top - POINTER_GAP - hoverHeight >= VIEWPORT_PAD
  ) {
    effectivePlacement = "top";
  } else if (
    placement === "top" &&
    anchor.top - POINTER_GAP - hoverHeight < VIEWPORT_PAD &&
    anchor.bottom + POINTER_GAP + hoverHeight <= viewportHeight - VIEWPORT_PAD
  ) {
    effectivePlacement = "bottom";
  } else if (
    placement === "right" &&
    anchor.right + POINTER_GAP + hoverWidth > viewportWidth - VIEWPORT_PAD &&
    anchor.left - POINTER_GAP - hoverWidth >= VIEWPORT_PAD
  ) {
    effectivePlacement = "left";
  } else if (
    placement === "left" &&
    anchor.left - POINTER_GAP - hoverWidth < VIEWPORT_PAD &&
    anchor.right + POINTER_GAP + hoverWidth <= viewportWidth - VIEWPORT_PAD
  ) {
    effectivePlacement = "right";
  }

  switch (effectivePlacement) {
    case "bottom":
      left = centerX - hoverWidth / 2;
      top = anchor.bottom + POINTER_GAP;
      pointerClass = "workbench-hover-pointer top";
      break;
    case "left":
      left = anchor.left - hoverWidth - POINTER_GAP;
      top = centerY - hoverHeight / 2;
      pointerClass = "workbench-hover-pointer right";
      break;
    case "right":
      left = anchor.right + POINTER_GAP;
      top = centerY - hoverHeight / 2;
      pointerClass = "workbench-hover-pointer left";
      break;
    case "top":
    default:
      left = centerX - hoverWidth / 2;
      top = anchor.top - hoverHeight - POINTER_GAP;
      pointerClass = "workbench-hover-pointer bottom";
      break;
  }

  // Keep the hover fully inside the agent webview — never clip off the side panel.
  left = Math.max(
    VIEWPORT_PAD,
    Math.min(left, viewportWidth - hoverWidth - VIEWPORT_PAD),
  );
  top = Math.max(
    VIEWPORT_PAD,
    Math.min(top, viewportHeight - hoverHeight - VIEWPORT_PAD),
  );

  return { left, top, pointerClass };
}

function MeasuredHover({
  content,
  anchor,
  placement,
}: NonNullable<HoverState>) {
  const hoverRef = useRef<HTMLDivElement>(null);
  // Start off-screen so shrink-to-fit is not constrained by a corner anchor.
  const [position, setPosition] = useState<{ left: number; top: number }>({
    left: VIEWPORT_PAD,
    top: -10_000,
  });
  const [pointerClass, setPointerClass] = useState(
    "workbench-hover-pointer bottom",
  );
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const el = hoverRef.current;
    if (!el) {
      return;
    }

    // Natural size first (unconstrained). Corner anchors previously forced a
    // tiny shrink-to-fit width and overflow-wrap turned "Delete" into "Dele/te".
    const rect = el.getBoundingClientRect();
    const hoverWidth = Math.max(1, Math.ceil(rect.width));
    const hoverHeight = Math.max(1, Math.ceil(rect.height));
    const next = getHoverPosition(
      anchor,
      hoverWidth,
      hoverHeight,
      placement,
      window.innerWidth,
      window.innerHeight,
    );
    setPosition({ left: next.left, top: next.top });
    setPointerClass(next.pointerClass);
    setReady(true);
  }, [anchor, content, placement]);

  return (
    <div
      className="agent-workbench-hover-anchor"
      style={{
        left: position.left,
        top: position.top,
        visibility: ready ? "visible" : "hidden",
      }}
    >
      <div
        ref={hoverRef}
        className="monaco-hover workbench-hover compact with-pointer fade-in"
        role="tooltip"
      >
        <div className="hover-row markdown-hover">
          <div className="hover-contents">{content}</div>
        </div>
        <div className={pointerClass} />
      </div>
    </div>
  );
}

export function WorkbenchHoverHost() {
  const state = useSyncExternalStore(
    workbenchHoverManager.subscribe,
    workbenchHoverManager.getSnapshot,
    workbenchHoverManager.getSnapshot,
  );

  if (!state) {
    return null;
  }

  return createPortal(
    <div className="agent-workbench-hover-layer">
      <MeasuredHover {...state} />
    </div>,
    document.body,
  );
}
