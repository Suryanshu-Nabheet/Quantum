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
  const pad = 8;

  let left: number;
  let top: number;
  let pointerClass: string;

  switch (placement) {
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
  left = Math.max(pad, Math.min(left, viewportWidth - hoverWidth - pad));
  top = Math.max(pad, Math.min(top, viewportHeight - hoverHeight - pad));

  return { left, top, pointerClass };
}

function MeasuredHover({
  content,
  anchor,
  placement,
}: NonNullable<HoverState>) {
  const hoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number }>({
    left: anchor.left,
    top: anchor.top - 40,
  });
  const [pointerClass, setPointerClass] = useState(
    "workbench-hover-pointer bottom",
  );

  useLayoutEffect(() => {
    const el = hoverRef.current;
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const next = getHoverPosition(
      anchor,
      rect.width,
      rect.height,
      placement,
      window.innerWidth,
      window.innerHeight,
    );
    setPosition({ left: next.left, top: next.top });
    setPointerClass(next.pointerClass);
  }, [anchor, content, placement]);

  return (
    <div
      className="agent-workbench-hover-anchor"
      style={{ left: position.left, top: position.top }}
    >
      <div
        ref={hoverRef}
        className="monaco-hover workbench-hover compact with-pointer fade-in"
        role="tooltip"
        style={{ maxWidth: Math.min(280, window.innerWidth - 16) }}
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
