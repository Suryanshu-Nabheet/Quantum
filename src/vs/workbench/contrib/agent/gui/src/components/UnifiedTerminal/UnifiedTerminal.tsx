import Anser, { AnserJsonEntry } from "anser";
import { ToolCallState } from "core";
import { escapeCarriageReturn } from "escape-carriage";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { useAppDispatch } from "../../redux/hooks";
import { moveTerminalProcessToBackground } from "../../redux/thunks/moveTerminalProcessToBackground";
import { getFontSize } from "../../util";
import { ActivityLabel } from "../ui/ActivityLabel";
import { ActivityChevron } from "../ui/ActivityChevron";
import { CopyButton } from "../StyledMarkdownPreview/StepContainerPreToolbar/CopyButton";
import { RunInTerminalButton } from "../StyledMarkdownPreview/StepContainerPreToolbar/RunInTerminalButton";

const AnsiSpan = styled.span<{
  bg?: string;
  fg?: string;
  decoration?: string;
}>`
  ${({ bg }) => bg && `background-color: rgb(${bg});`}
  ${({ fg }) => fg && `color: rgb(${fg});`}
  ${({ decoration }) => {
    switch (decoration) {
      case "bold":
        return "font-weight: bold;";
      case "dim":
        return "opacity: 0.5;";
      case "italic":
        return "font-style: italic;";
      case "hidden":
        return "visibility: hidden;";
      case "strikethrough":
        return "text-decoration: line-through;";
      case "underline":
        return "text-decoration: underline;";
      case "blink":
        return "text-decoration: blink;";
      default:
        return "";
    }
  }}
`;

const AnsiLink = styled.a`
  color: var(--link);
  text-decoration: none;
  &:hover {
    text-decoration: underline;
  }
`;

const StyledTerminalContainer = styled.div<{
  fontSize?: number;
}>`
  background-color: var(--background);
  font-family:
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Roboto,
    "Helvetica Neue",
    Arial,
    "Noto Sans",
    sans-serif;
  font-size: ${(props) => props.fontSize || getFontSize()}px;
  color: var(--foreground);
  line-height: 1.5;

  > *:last-child {
    margin-bottom: 0;
  }
`;

const TerminalContent = styled.div`
  font-family:
    ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono",
    Menlo, monospace;
  font-size: ${getFontSize() - 2}px;
  line-height: 1.5;

  pre {
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font: inherit;
  }
`;

function ansiToJSON(
  input: string,
  use_classes: boolean = false,
): AnserJsonEntry[] {
  input = escapeCarriageReturn(fixBackspace(input));
  return Anser.ansiToJson(input, {
    json: true,
    remove_empty: true,
    use_classes,
  });
}

function createClass(bundle: AnserJsonEntry): string | null {
  let classNames: string = "";

  if (bundle.bg) {
    classNames += `${bundle.bg}-bg `;
  }
  if (bundle.fg) {
    classNames += `${bundle.fg}-fg `;
  }
  if (bundle.decoration) {
    classNames += `ansi-${bundle.decoration} `;
  }

  if (classNames === "") {
    return null;
  }

  classNames = classNames.substring(0, classNames.length - 1);
  return classNames;
}

function convertBundleIntoReact(
  linkify: boolean,
  useClasses: boolean,
  bundle: AnserJsonEntry,
  key: number,
): JSX.Element {
  const className = useClasses ? createClass(bundle) : null;
  const decorationProp = bundle.decoration
    ? String(bundle.decoration)
    : undefined;

  if (!linkify) {
    return (
      <AnsiSpan
        key={key}
        className={className || undefined}
        bg={useClasses ? undefined : bundle.bg}
        fg={useClasses ? undefined : bundle.fg}
        decoration={decorationProp}
      >
        {bundle.content}
      </AnsiSpan>
    );
  }

  const content: React.ReactNode[] = [];
  const linkRegex = /(\s|^)(https?:\/\/[^\s]+|www\.[^\s]+\.[^\s]{2,})/g;

  let index = 0;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(bundle.content)) !== null) {
    const [, pre, url] = match;

    const startIndex = match.index + pre.length;
    if (startIndex > index) {
      content.push(bundle.content.substring(index, startIndex));
    }

    const href = url.startsWith("www.") ? `http://${url}` : url;

    content.push(
      <AnsiLink key={index} href={href} target="_blank">
        {url}
      </AnsiLink>,
    );

    index = linkRegex.lastIndex;
  }

  if (index < bundle.content.length) {
    content.push(bundle.content.substring(index));
  }

  return (
    <AnsiSpan
      key={key}
      className={className || undefined}
      bg={useClasses ? undefined : bundle.bg}
      fg={useClasses ? undefined : bundle.fg}
      decoration={decorationProp}
    >
      {content}
    </AnsiSpan>
  );
}

function fixBackspace(txt: string) {
  let tmp = txt;
  do {
    txt = tmp;
    tmp = txt.replace(/[^\n]\x08/gm, "");
  } while (tmp.length < txt.length);
  return txt;
}

function AnsiRenderer({
  children,
  linkify = false,
}: {
  children?: string;
  linkify?: boolean;
}) {
  const ansiContent = ansiToJSON(children ?? "", false).map((bundle, i) =>
    convertBundleIntoReact(linkify, false, bundle, i),
  );

  return <>{ansiContent}</>;
}

interface StatusIconProps {
  status: "running" | "completed" | "failed" | "background";
}

function StatusIcon({ status }: StatusIconProps) {
  const getStatusColor = () => {
    switch (status) {
      case "running":
        return "bg-success";
      case "completed":
        return "bg-success";
      case "background":
        return "bg-accent";
      case "failed":
        return "bg-error";
      default:
        return "bg-success";
    }
  };

  return (
    <span
      className={`mr-2 h-2 w-2 rounded-full ${getStatusColor()} ${
        status === "running" ? "motion-safe:animate-pulse" : ""
      }`}
    />
  );
}

interface UnifiedTerminalCommandProps {
  command: string;
  output?: string;
  status?: "running" | "completed" | "failed" | "background";
  statusMessage?: string;
  toolCallState?: ToolCallState;
  toolCallId?: string;
  displayLines?: number;
}

export function UnifiedTerminalCommand({
  command,
  output = "",
  status = "completed",
  statusMessage = "",
  toolCallState,
  toolCallId,
  displayLines = 8,
}: UnifiedTerminalCommandProps) {
  const dispatch = useAppDispatch();
  const [isExpanded, setIsExpanded] = useState(toolCallState?.status !== "errored");
  const [outputExpanded, setOutputExpanded] = useState(false);
  const commandPanelRef = useRef<HTMLDivElement>(null);

  // Determine running state
  const isRunning = toolCallState?.status === "calling" || status === "running";
  const hasOutput = output.length > 0;
  const callStatus = toolCallState?.status;
  const hasNotRun = callStatus === "generating" || callStatus === "generated" || callStatus === "canceled";
  const commandLabel = isRunning
    ? "Running command"
    : callStatus === "canceled"
      ? "Run command"
      : callStatus === "generating"
        ? "Run command"
        : callStatus === "generated"
          ? "Run command · Awaiting approval"
          : callStatus === "errored"
        ? "Run command"
            : "Ran command";

  useEffect(() => {
    if (callStatus === "errored") {
      setIsExpanded(false);
    }
  }, [callStatus]);

  // Process terminal content for line limiting
  const processedTerminalContent = useMemo(() => {
    if (!output) {
      return {
        fullContent: "",
        limitedContent: "",
        totalLines: 0,
        isLimited: false,
        hiddenLinesCount: 0,
      };
    }

    const lines = output.split("\n");
    const totalLines = lines.length;

    if (totalLines > displayLines) {
      const lastLines = lines.slice(-displayLines);
      return {
        fullContent: output,
        limitedContent: lastLines.join("\n"),
        totalLines,
        isLimited: true,
        hiddenLinesCount: totalLines - displayLines,
      };
    }

    return {
      fullContent: output,
      limitedContent: output,
      totalLines,
      isLimited: false,
      hiddenLinesCount: 0,
    };
  }, [output, displayLines]);

  // Determine status type
  let statusType: "running" | "completed" | "failed" | "background" = status;
  if (isRunning) {
    statusType = "running";
  } else if (statusMessage?.includes("failed")) {
    statusType = "failed";
  } else if (statusMessage?.includes("background")) {
    statusType = "background";
  }

  const handleMoveToBackground = () => {
    if (toolCallId) {
      void dispatch(
        moveTerminalProcessToBackground({
          toolCallId,
        }),
      );
    }
  };

  // Create combined content for copying (command + output)
  const copyContent = useMemo(() => {
    let content = command;
    if (hasOutput) {
      content += `\n\n${output}`;
    }
    return content;
  }, [command, output, hasOutput]);

  useLayoutEffect(() => {
    if (commandPanelRef.current) {
      commandPanelRef.current.inert = !isExpanded;
    }
  }, [isExpanded]);

  return (
    <StyledTerminalContainer
      fontSize={getFontSize()}
      data-testid="terminal-container"
    >
      <div className={`${isExpanded ? "mb-1" : "mb-0"} flex items-center gap-2`}>
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((expanded) => !expanded)}
          className="agent-activity-row text-description border-0 bg-transparent p-0 text-left hover:brightness-125"
        >
          <ActivityLabel
            text={commandLabel}
            status={callStatus === "errored" ? "Failed" : callStatus === "canceled" ? "Canceled" : undefined}
          />
          <ActivityChevron open={isExpanded} />
        </button>
      </div>

      <div
        ref={commandPanelRef}
        className={`terminal-command-collapsible${
          isExpanded ? "" : " terminal-command-collapsed"
        }`}
        aria-hidden={!isExpanded}
      >
        <div className="terminal-command-inner">
          <div className="outline-command-border bg-editor min-w-0 overflow-hidden rounded-default outline outline-1">
            <TerminalContent>
              <div className="flex min-w-0 items-start gap-2 px-2 py-2">
                <span className="text-description select-none" aria-hidden="true">
                  $
                </span>
                <pre className="text-terminal min-w-0 flex-1">{command}</pre>
                {!isRunning && (
                  <div className="flex shrink-0 items-center gap-2">
                    <CopyButton text={copyContent} />
                    {!hasNotRun && <RunInTerminalButton command={command} />}
                  </div>
                )}
              </div>

              {hasOutput && (
                <div className="border-command-border border-t">
                  {processedTerminalContent.isLimited && (
                    <button
                      type="button"
                      aria-expanded={outputExpanded}
                      onClick={() => setOutputExpanded((expanded) => !expanded)}
                      className="text-description w-full border-0 bg-transparent px-2 pt-1.5 text-left text-xs hover:brightness-125"
                    >
                      {outputExpanded
                        ? "Show less output"
                        : `Show ${processedTerminalContent.hiddenLinesCount} earlier lines`}
                    </button>
                  )}
                  <div
                    role="region"
                    aria-label="Command output"
                    tabIndex={0}
                    className="text-description max-h-64 overflow-auto px-2 py-2"
                  >
                    <pre>
                      <AnsiRenderer linkify>
                        {outputExpanded
                          ? processedTerminalContent.fullContent
                          : processedTerminalContent.limitedContent}
                      </AnsiRenderer>
                    </pre>
                  </div>
                </div>
              )}
            </TerminalContent>

            {(statusMessage || isRunning || statusType === "failed") && (
              <div className="text-description border-command-border flex flex-wrap items-center border-t px-2 py-1.5 text-xs">
                <StatusIcon status={statusType} />
                {isRunning ? "Running" : statusMessage || "Command failed"}
                {isRunning && toolCallId && (
                  <button
                    type="button"
                    onClick={handleMoveToBackground}
                    className="text-link ml-3 border-0 bg-transparent p-0 text-xs hover:underline"
                  >
                    Move to background
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </StyledTerminalContainer>
  );
}
