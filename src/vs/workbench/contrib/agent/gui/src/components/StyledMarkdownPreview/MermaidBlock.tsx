import {
  ArrowPathRoundedSquareIcon,
  ArrowsPointingOutIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  XMarkIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
} from "@heroicons/react/24/outline";
import DOMPurify from "dompurify";
import type { PanzoomObject } from "@panzoom/panzoom";
import { useContext, useEffect, useId, useRef, useState } from "react";
import { HostBridgeContext } from "../../context/HostBridge";
import { useDebouncedEffect } from "../find/useDebounce";
import { ToolTip } from "../gui/Tooltip";

const MINIMUM_ZOOM_STEP = 0.05;

function readCssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") {
    return fallback;
  }
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

function buildThemeVariables() {
  return {
    background: readCssVar("--vscode-editor-background", "#1e1e1e"),
    primaryColor: readCssVar("--vscode-button-background", "#4d8bf0"),
    primaryTextColor: readCssVar("--vscode-editor-foreground", "#e6e6e6"),
    primaryBorderColor: readCssVar("--vscode-focusBorder", "#4d8bf0"),
    secondaryColor: readCssVar("--vscode-badge-background", "#3a6db3"),
    secondaryTextColor: readCssVar("--vscode-badge-foreground", "#ffffff"),
    secondaryBorderColor: readCssVar("--vscode-focusBorder", "#3a6db3"),
    tertiaryColor: readCssVar("--vscode-charts-green", "#59bc89"),
    tertiaryTextColor: readCssVar("--vscode-editor-foreground", "#ffffff"),
    tertiaryBorderColor: readCssVar("--vscode-charts-green", "#59bc89"),
    noteBkgColor: readCssVar("--vscode-textBlockQuote-background", "#2d2d2d"),
    noteTextColor: readCssVar("--vscode-editor-foreground", "#e6e6e6"),
    noteBorderColor: readCssVar("--vscode-panel-border", "#555555"),
    lineColor: readCssVar("--vscode-descriptionForeground", "#8c8c8c"),
    textColor: readCssVar("--vscode-editor-foreground", "#e6e6e6"),
    mainBkg: readCssVar("--vscode-sideBar-background", "#252525"),
    errorBkgColor: readCssVar(
      "--vscode-inputValidation-errorBackground",
      "#f44336",
    ),
    errorTextColor: readCssVar("--vscode-editor-foreground", "#ffffff"),
    nodeBorder: readCssVar("--vscode-descriptionForeground", "#8c8c8c"),
    clusterBkg: readCssVar("--vscode-sideBar-background", "#2a2a2a"),
    clusterBorder: readCssVar("--vscode-descriptionForeground", "#8c8c8c"),
    defaultLinkColor: readCssVar("--vscode-descriptionForeground", "#8c8c8c"),
    titleColor: readCssVar("--vscode-editor-foreground", "#e6e6e6"),
    edgeLabelBackground: readCssVar("--vscode-editor-background", "#252525"),
    fontSize: "14px",
    fontFamily: readCssVar("--vscode-font-family", "sans-serif"),
  };
}

let mermaidLoadPromise: Promise<typeof import("mermaid").default> | undefined;

async function getMermaid() {
  mermaidLoadPromise ??= import("mermaid")
    .then((module) => module.default)
    .catch((error) => {
      mermaidLoadPromise = undefined;
      throw error;
    });
  return mermaidLoadPromise;
}

/** Disambiguate a labelled subgraph from a node with the same identifier. */
function repairSubgraphCollision(
  code: string,
  error: unknown,
): string | undefined {
  const match =
    error instanceof Error
      ? /^Setting ([\w-]+) as parent of \1 would create a cycle$/.exec(
          error.message,
        )
      : null;
  if (!match) return undefined;
  const id = match[1];
  const declaration = new RegExp(`^(\\s*subgraph\\s+)${id}(?=\\s*\\[)`, "gm");
  if ([...code.matchAll(declaration)].length !== 1) return undefined;
  let replacement = `quantum_group_${id.replace(/-/g, "_")}`;
  while (new RegExp(`\\b${replacement}\\b`).test(code)) replacement += "_";
  return code.replace(declaration, `$1${replacement}`);
}

export default function MermaidDiagram({
  code,
  standalone = false,
}: {
  code: string;
  standalone?: boolean;
}) {
  const hostBridge = useContext(HostBridgeContext);
  const reactId = useId().replace(/:/g, "");
  const mermaidRenderContainerRef = useRef<HTMLDivElement>(null);
  const renderGenerationRef = useRef(0);
  const panzoomRef = useRef<PanzoomObject | null>(null);
  const wheelHandlerRef = useRef<((event: WheelEvent) => void) | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [openError, setOpenError] = useState(false);

  useEffect(() => {
    renderGenerationRef.current++;
    setIsLoading(true);
    setError("");
  }, [code]);

  useDebouncedEffect(
    () => {
      const container = mermaidRenderContainerRef.current;
      if (!container) {
        return;
      }
      const renderGeneration = renderGenerationRef.current;

      // Tear down previous panzoom / wheel listener before re-render.
      if (wheelHandlerRef.current && container.parentElement) {
        container.parentElement.removeEventListener(
          "wheel",
          wheelHandlerRef.current,
        );
        wheelHandlerRef.current = null;
      }
      panzoomRef.current?.destroy?.();
      panzoomRef.current = null;
      container.innerHTML = "";

      if (!code.trim()) {
        setIsLoading(false);
        return;
      }

      const diagramId = `mermaid-${reactId}-${renderGeneration}`;

      void (async () => {
        let scratch: HTMLDivElement | undefined;
        try {
          const [{ default: Panzoom }, mermaid] = await Promise.all([
            import("@panzoom/panzoom"),
            getMermaid(),
          ]);
          if (
            renderGeneration !== renderGenerationRef.current ||
            !container.isConnected
          ) {
            return;
          }

          mermaid.initialize({
            startOnLoad: false,
            securityLevel: "strict",
            theme: "base",
            themeVariables: buildThemeVariables(),
            flowchart: { htmlLabels: false },
            suppressErrorRendering: true,
          });

          await mermaid.parse(code);
          if (renderGeneration !== renderGenerationRef.current) {
            return;
          }
          scratch = document.createElement("div");
          scratch.style.cssText =
            "position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none";
          document.body.appendChild(scratch);
          let rendered: Awaited<ReturnType<typeof mermaid.render>>;
          try {
            rendered = await mermaid.render(diagramId, code, scratch);
          } catch (error) {
            const repaired = repairSubgraphCollision(code, error);
            if (!repaired) throw error;
            rendered = await mermaid.render(
              `${diagramId}-repaired`,
              repaired,
              scratch,
            );
          }
          if (renderGeneration !== renderGenerationRef.current) {
            return;
          }
          const sanitizeOptions = {
            USE_PROFILES: { svg: true, svgFilters: true },
            ADD_TAGS: ["foreignObject", "div", "span", "p", "br"],
            ADD_ATTR: ["dominant-baseline", "text-anchor", "style", "class"],
            HTML_INTEGRATION_POINTS: { foreignobject: true },
          };
          const sanitized = DOMPurify.sanitize(rendered.svg, sanitizeOptions);
          container.innerHTML = sanitized;
          setError("");

          const panzoom = Panzoom(container, {
            step: MINIMUM_ZOOM_STEP,
          });
          panzoomRef.current = panzoom;

          const onWheel = (event: WheelEvent) => {
            if (
              event.target instanceof Element &&
              event.target.closest(".agent-mermaid-toolbar")
            )
              return;
            if (event.ctrlKey || event.metaKey) {
              event.preventDefault();
              const delta = Math.max(-100, Math.min(100, event.deltaY));
              panzoom.zoomToPoint(
                panzoom.getScale() * Math.exp(-delta * 0.01),
                event,
                { animate: false },
              );
            } else if (event.shiftKey) {
              panzoom.zoomWithWheel(event);
            } else if (standalone) {
              event.preventDefault();
              const scale = panzoom.getScale();
              const multiplier =
                event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1;
              panzoom.pan(
                (-event.deltaX * multiplier) / scale,
                (-event.deltaY * multiplier) / scale,
                { relative: true, animate: false },
              );
            }
          };
          wheelHandlerRef.current = onWheel;
          container.parentElement?.addEventListener("wheel", onWheel, {
            passive: false,
          });
        } catch (err: unknown) {
          if (renderGeneration !== renderGenerationRef.current) {
            return;
          }
          const message =
            err instanceof Error
              ? err.message
              : "Unknown error when parsing or rendering the Mermaid diagram.";
          setError(message);
        } finally {
          scratch?.remove();
          if (renderGeneration === renderGenerationRef.current) {
            setIsLoading(false);
          }
        }
      })();
    },
    500,
    [code, reactId, standalone],
  );

  useEffect(() => {
    return () => {
      renderGenerationRef.current++;
      const container = mermaidRenderContainerRef.current;
      if (wheelHandlerRef.current && container?.parentElement) {
        container.parentElement.removeEventListener(
          "wheel",
          wheelHandlerRef.current,
        );
      }
      panzoomRef.current?.destroy?.();
    };
  }, []);

  useEffect(() => {
    if (!standalone) return;
    hostBridge.post("agentDiagramReady", undefined);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape")
        hostBridge.post("closeAgentDiagram", undefined);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [standalone, hostBridge]);

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  const zoomIn = () =>
    panzoomRef.current?.zoomIn({ step: MINIMUM_ZOOM_STEP * 4 });
  const zoomOut = () =>
    panzoomRef.current?.zoomOut({ step: MINIMUM_ZOOM_STEP * 4 });
  const resetZoom = () => panzoomRef.current?.reset();

  return (
    <div
      className={
        standalone ? "agent-mermaid agent-mermaid-standalone" : "agent-mermaid"
      }
    >
      {isLoading && (
        <div className="text-description px-3 py-2 text-xs">
          Generating diagram…
        </div>
      )}
      {!!error && !isLoading && (
        <div className="text-description px-3 py-2 text-xs" role="status">
          Unable to render diagram.
          <details className="agent-mermaid-error-details">
            <summary>Show details</summary>
            <div className="whitespace-pre-wrap">{error}</div>
            <pre className="mt-2 whitespace-pre-wrap text-xs">{code}</pre>
          </details>
        </div>
      )}
      <div className="mermaid relative">
        <div className="agent-mermaid-toolbar">
          <ToolTip content={standalone ? "Close diagram" : "Open diagram"}>
            <button
              type="button"
              className="agent-mermaid-button"
              disabled={!standalone && (isLoading || !!error || !code.trim())}
              title={standalone ? "Close diagram" : "Open diagram"}
              onClick={async () => {
                if (standalone) {
                  hostBridge.post("closeAgentDiagram", undefined);
                  return;
                }
                try {
                  const result = await hostBridge.request("openAgentDiagram", {
                    source: code,
                  });
                  setOpenError(result.status === "error");
                } catch {
                  setOpenError(true);
                }
              }}
              aria-label={standalone ? "Close diagram" : "Open diagram"}
            >
              {standalone ? (
                <XMarkIcon className="h-4 w-4" />
              ) : (
                <ArrowsPointingOutIcon className="h-4 w-4" />
              )}
            </button>
          </ToolTip>
          <ToolTip content={copied ? "Copied" : "Copy Mermaid source"}>
            <button
              type="button"
              className="agent-mermaid-button"
              title="Copy Mermaid source"
              onClick={async () => {
                try {
                  const result = await hostBridge.request("copyText", {
                    text: code,
                  });
                  setCopyError(result.status === "error");
                  setCopied(result.status === "success");
                } catch {
                  setCopyError(true);
                }
              }}
              aria-label="Copy Mermaid source"
            >
              {copied ? (
                <CheckIcon className="h-4 w-4" />
              ) : (
                <ClipboardDocumentIcon className="h-4 w-4" />
              )}
            </button>
          </ToolTip>
          <ToolTip content="Zoom in">
            <button
              type="button"
              className="agent-mermaid-button"
              title="Zoom in"
              disabled={isLoading || !!error}
              onClick={zoomIn}
              aria-label="Zoom in"
            >
              <MagnifyingGlassPlusIcon className="h-4 w-4 cursor-pointer" />
            </button>
          </ToolTip>
          <ToolTip content="Zoom out">
            <button
              type="button"
              className="agent-mermaid-button"
              title="Zoom out"
              disabled={isLoading || !!error}
              onClick={zoomOut}
              aria-label="Zoom out"
            >
              <MagnifyingGlassMinusIcon className="h-4 w-4 cursor-pointer" />
            </button>
          </ToolTip>
          <ToolTip content="Reset zoom">
            <button
              type="button"
              className="agent-mermaid-button"
              title="Reset zoom"
              disabled={isLoading || !!error}
              onClick={resetZoom}
              aria-label="Reset zoom"
            >
              <ArrowPathRoundedSquareIcon className="h-4 w-4 cursor-pointer" />
            </button>
          </ToolTip>
        </div>
        <div
          className="agent-mermaid-canvas flex min-h-12 justify-center p-3"
          ref={mermaidRenderContainerRef}
        />
        {standalone && !error && !isLoading && (
          <div className="agent-mermaid-gesture-hint">
            Pinch to zoom · two-finger scroll to pan
          </div>
        )}
        {copyError && (
          <div role="alert" className="text-error px-3 pb-2 text-xs">
            Could not copy the diagram source.
          </div>
        )}
        {openError && (
          <div role="alert" className="text-error px-3 pb-2 text-xs">
            Could not open the diagram.
          </div>
        )}
      </div>
    </div>
  );
}
