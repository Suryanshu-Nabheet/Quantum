import {
  ArrowPathRoundedSquareIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
} from "@heroicons/react/24/outline";
import DOMPurify from "dompurify";
import { useEffect, useId, useRef, useState } from "react";
import { useDebouncedEffect } from "../find/useDebounce";
import { ToolTip } from "../gui/Tooltip";

const MINIMUM_ZOOM_STEP = 0.05;

/** True while the fence is still streaming / incomplete. */
function looksIncomplete(code: string): boolean {
  const trimmed = code.trim();
  if (!trimmed) {
    return true;
  }
  // Common mid-stream cases: trailing arrow, open quotes, unfinished edge labels
  if (/-->\s*$/.test(trimmed) || /-->>\s*$/.test(trimmed)) {
    return true;
  }
  if ((trimmed.match(/"/g) ?? []).length % 2 === 1) {
    return true;
  }
  if ((trimmed.match(/\[/g) ?? []).length !== (trimmed.match(/]/g) ?? []).length) {
    return true;
  }
  if ((trimmed.match(/\(/g) ?? []).length !== (trimmed.match(/\)/g) ?? []).length) {
    return true;
  }
  return false;
}

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
    lineColor: readCssVar("--vscode-editorLineNumber-foreground", "#8c8c8c"),
    textColor: readCssVar("--vscode-editor-foreground", "#e6e6e6"),
    mainBkg: readCssVar("--vscode-sideBar-background", "#252525"),
    errorBkgColor: readCssVar("--vscode-inputValidation-errorBackground", "#f44336"),
    errorTextColor: readCssVar("--vscode-editor-foreground", "#ffffff"),
    nodeBorder: readCssVar("--vscode-panel-border", "#555555"),
    clusterBkg: readCssVar("--vscode-sideBar-background", "#2a2a2a"),
    clusterBorder: readCssVar("--vscode-panel-border", "#555555"),
    defaultLinkColor: readCssVar("--vscode-editorLineNumber-foreground", "#8c8c8c"),
    titleColor: readCssVar("--vscode-editor-foreground", "#e6e6e6"),
    edgeLabelBackground: readCssVar("--vscode-editor-background", "#252525"),
    fontSize: "14px",
    fontFamily: readCssVar("--vscode-font-family", "sans-serif"),
  };
}

let mermaidLoadPromise:
  | Promise<typeof import("mermaid").default>
  | undefined;

async function getMermaid() {
  mermaidLoadPromise ??= import("mermaid").then((module) => module.default);
  return mermaidLoadPromise;
}

export default function MermaidDiagram({ code }: { code: string }) {
  const reactId = useId().replace(/:/g, "");
  const mermaidRenderContainerRef = useRef<HTMLDivElement>(null);
  const panzoomRef = useRef<{ destroy?: () => void; zoomIn: (o?: object) => void; zoomOut: (o?: object) => void; reset: () => void; zoomWithWheel: (e: WheelEvent) => void } | null>(null);
  const wheelHandlerRef = useRef<((event: WheelEvent) => void) | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    setPending(looksIncomplete(code));
  }, [code]);

  useDebouncedEffect(
    () => {
      const container = mermaidRenderContainerRef.current;
      if (!container) {
        return;
      }

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

      if (looksIncomplete(code)) {
        setPending(true);
        setError("");
        setIsLoading(false);
        return;
      }

      setPending(false);
      const diagramId = `mermaid-${reactId}-${Math.random().toString(36).slice(2, 9)}`;

      void (async () => {
        try {
          const [{ default: Panzoom }, mermaid] = await Promise.all([
            import("@panzoom/panzoom"),
            getMermaid(),
          ]);

          mermaid.initialize({
            startOnLoad: false,
            securityLevel: "strict",
            theme: "base",
            themeVariables: buildThemeVariables(),
          });

          await mermaid.parse(code);
          const rendered = await mermaid.render(diagramId, code);
          const sanitized = DOMPurify.sanitize(rendered.svg, {
            USE_PROFILES: { svg: true, svgFilters: true },
            ADD_TAGS: ["foreignObject"],
            ADD_ATTR: ["dominant-baseline", "text-anchor", "style", "class"],
          });
          if (!mermaidRenderContainerRef.current) {
            return;
          }
          mermaidRenderContainerRef.current.innerHTML = sanitized;
          setError("");

          const panzoom = Panzoom(mermaidRenderContainerRef.current, {
            step: MINIMUM_ZOOM_STEP,
          });
          panzoomRef.current = panzoom;

          const onWheel = (event: WheelEvent) => {
            if (!event.shiftKey) {
              return;
            }
            panzoom.zoomWithWheel(event);
          };
          wheelHandlerRef.current = onWheel;
          mermaidRenderContainerRef.current.parentElement?.addEventListener(
            "wheel",
            onWheel,
            { passive: false },
          );
        } catch (err: unknown) {
          const message =
            err instanceof Error
              ? err.message
              : "Unknown error when parsing or rendering the Mermaid diagram.";
          // Soft-fail during stream-like parse errors
          if (/Expecting|Lexical error|Parse error/i.test(message)) {
            setPending(true);
            setError("");
          } else {
            setError(message);
          }
        } finally {
          setIsLoading(false);
        }
      })();
    },
    500,
    [code, reactId],
  );

  useEffect(() => {
    return () => {
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

  const zoomIn = () =>
    panzoomRef.current?.zoomIn({ step: MINIMUM_ZOOM_STEP * 4 });
  const zoomOut = () =>
    panzoomRef.current?.zoomOut({ step: MINIMUM_ZOOM_STEP * 4 });
  const resetZoom = () => panzoomRef.current?.reset();

  return (
    <div className="border-command-border bg-vsc-editor-background my-2 overflow-hidden rounded-md border border-solid">
      {isLoading && (
        <div className="text-description px-3 py-2 text-xs">
          Generating diagram…
        </div>
      )}
      {!isLoading && pending && !error && (
        <div className="text-description px-3 py-2 text-xs">
          Drawing diagram…
        </div>
      )}
      {!!error ? (
        <div className="text-error whitespace-pre-wrap px-3 py-2 text-sm">
          {error}
        </div>
      ) : (
        <div className="mermaid relative">
          <div className="bg-vsc-background absolute right-1 top-1 z-10 flex items-center gap-x-1 rounded px-1 py-0.5">
            <ToolTip content="Zoom in">
              <button
                type="button"
                className="text-description hover:text-foreground border-0 bg-transparent p-0.5"
                onClick={zoomIn}
                aria-label="Zoom in"
              >
                <MagnifyingGlassPlusIcon className="h-4 w-4 cursor-pointer" />
              </button>
            </ToolTip>
            <ToolTip content="Zoom out">
              <button
                type="button"
                className="text-description hover:text-foreground border-0 bg-transparent p-0.5"
                onClick={zoomOut}
                aria-label="Zoom out"
              >
                <MagnifyingGlassMinusIcon className="h-4 w-4 cursor-pointer" />
              </button>
            </ToolTip>
            <ToolTip content="Reset zoom">
              <button
                type="button"
                className="text-description hover:text-foreground border-0 bg-transparent p-0.5"
                onClick={resetZoom}
                aria-label="Reset zoom"
              >
                <ArrowPathRoundedSquareIcon className="h-4 w-4 cursor-pointer" />
              </button>
            </ToolTip>
          </div>
          <div
            className="flex min-h-12 justify-center p-3"
            ref={mermaidRenderContainerRef}
          />
          <div className="text-description-muted px-3 pb-2 text-2xs">
            Shift + scroll to zoom
          </div>
        </div>
      )}
    </div>
  );
}
