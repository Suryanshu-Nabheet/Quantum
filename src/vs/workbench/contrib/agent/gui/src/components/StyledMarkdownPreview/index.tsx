import { ctxItemToRifWithContents } from "core/commands/util";
import type { Root } from "hast";
import {
  isValidElement,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import {
  useRemark,
  useRemarkSync,
  type UseRemarkOptions,
} from "react-remark";
import { ErrorBoundary } from "react-error-boundary";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import styled from "styled-components";
import { visit } from "unist-util-visit";
import { v4 as uuidv4 } from "uuid";
import {
  defaultBorderRadius,
  vscBackground,
  vscEditorBackground,
  vscForeground,
} from "..";
import useUpdatingRef from "../../hooks/useUpdatingRef";
import { useAppSelector } from "../../redux/hooks";
import { selectUIConfig } from "../../redux/slices/configSlice";
import { makeSelectPastContextItems } from "../../redux/selectors/selectPastContextItems";
import { getFontSize } from "../../util";
import { ToolTip } from "../gui/Tooltip";
import FilenameLink from "./FilenameLink";
import "./agentMarkdown.css";
import "./katex.css";
import "./markdown.css";
import MermaidBlock from "./MermaidBlock";
import { rehypeHighlightPlugin } from "./rehypeHighlightPlugin";
import { rehypeKatexOnDemand } from "./rehypeKatexOnDemand";
import { SecureImageComponent } from "./SecureImageComponent";
import { StepContainerPreToolbar } from "./StepContainerPreToolbar";
import SymbolLink from "./SymbolLink";
import { SyntaxHighlightedPre } from "./SyntaxHighlightedPre";
import { isSymbolNotRif, matchCodeToSymbolOrFile } from "./utils";
import { fixDoubleDollarNewLineLatex } from "./utils/fixDoubleDollarLatex";
import { patchNestedMarkdown } from "./utils/patchNestedMarkdown";

const StyledMarkdown = styled.div<{
  fontSize?: number;
  whiteSpace: string;
  bgColor: string;
  isThinking?: boolean;
  isRenderingInStepContainer?: boolean;
}>`
  h1 {
    font-size: 1.25em;
  }

  h2 {
    font-size: 1.15em;
  }

  h3 {
    font-size: 1.05em;
  }

  h4 {
    font-size: 1em;
  }

  h5 {
    font-size: 0.95em;
  }

  h6 {
    font-size: 0.9em;
  }

  p {
    margin: 0.5em 0;
  }

  p:first-child {
    margin-top: 0;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    margin: 0.65em 0 0.3em;
  }

  h1:first-child,
  h2:first-child,
  h3:first-child,
  h4:first-child,
  h5:first-child,
  h6:first-child {
    margin-top: 0;
  }

  pre {
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    margin: 0.5em 0;
    white-space: ${(props) => props.whiteSpace};
    background-color: ${vscEditorBackground};
    border-radius: ${defaultBorderRadius};
    overflow-x: auto;
    overflow-y: hidden;
    padding: 8px;
  }

  code {
    span.line:empty {
      display: none;
    }
    word-wrap: break-word;
    border-radius: 0.3125rem;
    background-color: ${vscEditorBackground};
    font-size: ${(props) => `${getFontSize() - 2}px`};
    font-family: var(--vscode-editor-font-family);
  }

  ul ul,
  ul ol,
  ol ul,
  ol ol {
    padding-left: 1.5em;
    margin-top: 0.25em;
  }

  li {
    margin-bottom: 0.3em;
  }
  li:last-child {
    margin-bottom: 0;
  }

  ul,
  ol {
    padding-left: 2em;
    margin: 0;
  }

  strong {
    font-weight: 600;
    color: ${(props) =>
      props.isThinking ? "var(--vscode-foreground)" : "inherit"};
  }

  code:not(pre > code) {
    font-family: var(--vscode-editor-font-family);
  }

  background-color: ${(props) => props.bgColor};
  font-family:
    var(--vscode-font-family),
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Roboto,
    Oxygen,
    Ubuntu,
    Cantarell,
    "Open Sans",
    "Helvetica Neue",
    sans-serif;
  font-size: ${(props) =>
    props.fontSize ? `${props.fontSize}px` : `${getFontSize()}px`};
  padding-left: ${(props) => (props.isRenderingInStepContainer ? "0" : "8px")};
  padding-right: ${(props) => (props.isRenderingInStepContainer ? "0" : "8px")};
  color: ${(props) =>
    props.isThinking ? "var(--vscode-descriptionForeground)" : vscForeground};

  p,
  li,
  ol,
  ul {
    line-height: 1.5;
  }

  * {
    word-break: break-word;
  }

  > *:last-child {
    margin-bottom: 0;
  }
`;

const fallbackMarkdownComponents = {
  a: ({ href, children }: { href?: string; children?: ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  table: (tableProps: ComponentProps<"table">) => (
    <div className="markdown-table-scroll">
      <table {...tableProps} className="markdown-table">
        {tableProps.children}
      </table>
    </div>
  ),
  pre: (preProps: ComponentProps<"pre">) => {
    const mermaidSource = extractMermaidSource(preProps);
    return mermaidSource !== null ? (
      <MermaidBlock code={mermaidSource} />
    ) : (
      <pre {...preProps} />
    );
  },
};

function splitMarkdownTableRow(line: string): string[] {
  const content = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let cell = "";
  let escaped = false;

  for (const character of content) {
    if (character === "|" && !escaped) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
    escaped = character === "\\" && !escaped;
  }

  cells.push(cell.trim());
  return cells;
}

function isMarkdownTableDivider(cells: string[]): boolean {
  return (
    cells.length > 1 &&
    cells.every(cell => /^\s*:?-{3,}:?\s*$/.test(cell))
  );
}

function parseMarkdownTableRow(
  line: string,
): { indent: string; cells: string[] } | undefined {
  const indent = line.match(/^ */)?.[0] ?? "";
  const content = line.slice(indent.length).trim();
  if (!content.startsWith("|") || !content.endsWith("|")) {
    return undefined;
  }

  const cells = splitMarkdownTableRow(content);
  return cells.length > 1 ? { indent, cells } : undefined;
}

/** Normalize compact pipe tables with collapsed rows or a missing GFM divider. */
function normalizePackedGfmTableRows(source: string): string {
  let activeFence: { character: string; length: number } | undefined;
  const lines = source.split("\n");

  return lines
    .map((line, index) => {
      const fence = line.match(/^ {0,3}(`{3,}|~{3,})/);
      if (activeFence) {
        if (
          fence &&
          fence[1][0] === activeFence.character &&
          fence[1].length >= activeFence.length &&
          /^ {0,3}(?:`{3,}|~{3,})\s*$/.test(line)
        ) {
          activeFence = undefined;
        }
        return line;
      }

      if (fence) {
        activeFence = {
          character: fence[1][0],
          length: fence[1].length,
        };
        return line;
      }

      const indent = line.match(/^ */)?.[0] ?? "";
      const trimmedLine = line.slice(indent.length);
      // Some models collapse Markdown table rows using `| |` instead of `||`.
      // Accept optional whitespace between the two row-boundary pipes.
      if (!trimmedLine.startsWith("|") || !/\|\s*\|/.test(trimmedLine)) {
        return line;
      }

      const rows = trimmedLine
        .split(/\s*\|\s*\|\s*/)
        .map(row => row.trim())
        .filter(Boolean)
        .map(row =>
          row
            .replace(/^\|/, "")
            .replace(/\|$/, ""),
        );
      const parsedRows = rows.map(splitMarkdownTableRow);
      if (parsedRows.length < 2) {
        return line;
      }

      const columnCount = parsedRows[0].length;
      if (columnCount < 2) {
        return line;
      }

      // Repair rows with missing cells and discard stray divider rows. A
      // malformed GFM table can throw inside micromark and prevent the entire
      // saved assistant response from rendering.
      for (let rowIndex = parsedRows.length - 1; rowIndex > 0; rowIndex--) {
        if (isMarkdownTableDivider(parsedRows[rowIndex]) && rowIndex !== 1) {
          parsedRows.splice(rowIndex, 1);
          continue;
        }
        if (parsedRows[rowIndex].length > columnCount) {
          const trailingCells = parsedRows[rowIndex].splice(columnCount - 1);
          parsedRows[rowIndex].push(trailingCells.join(" \\| "));
        }
        while (parsedRows[rowIndex].length < columnCount) {
          parsedRows[rowIndex].push(
            isMarkdownTableDivider(parsedRows[rowIndex]) ? "---" : "",
          );
        }
      }
      // GFM accepts the alignment row only immediately after the header.
      // Model output sometimes places a divider later in a packed table,
      // which can make micromark throw while parsing the assistant response.
      const hasValidHeaderDelimiter =
        parsedRows.length > 1 &&
        parsedRows[1].length === columnCount &&
        isMarkdownTableDivider(parsedRows[1]);
      if (!hasValidHeaderDelimiter) {
        parsedRows.splice(1, 0, parsedRows[0].map(() => "---"));
      }

      const normalized = parsedRows
        .map(row => `${indent}| ${row.join(" | ")} |`)
        .join("\n");
      return lines[index - 1]?.trim() ? `\n${normalized}` : normalized;
    })
    .join("\n");
}

/** Rejoin table rows separated by blank lines when message chunks split them. */
function normalizeSeparatedGfmTableRows(source: string): string {
  const lines = source.split("\n");
  const output: string[] = [];
  let activeFence: { character: string; length: number } | undefined;

  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    const fence = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (activeFence) {
      output.push(line);
      if (
        fence &&
        fence[1][0] === activeFence.character &&
        fence[1].length >= activeFence.length &&
        /^ {0,3}(?:`{3,}|~{3,})\s*$/.test(line)
      ) {
        activeFence = undefined;
      }
      index++;
      continue;
    }
    if (fence) {
      activeFence = { character: fence[1][0], length: fence[1].length };
      output.push(line);
      index++;
      continue;
    }

    const firstRow = parseMarkdownTableRow(line);
    if (!firstRow) {
      output.push(line);
      index++;
      continue;
    }

    const rows = [firstRow.cells];
    let nextIndex = index + 1;
    let skippedBlankLine = false;
    while (nextIndex < lines.length) {
      if (!lines[nextIndex].trim()) {
        if (skippedBlankLine) {
          break;
        }
        skippedBlankLine = true;
        nextIndex++;
        continue;
      }

      const row = parseMarkdownTableRow(lines[nextIndex]);
      if (!row || row.indent !== firstRow.indent) {
        break;
      }
      rows.push(row.cells);
      skippedBlankLine = false;
      nextIndex++;
    }

    if (rows.length < 2 || firstRow.cells.length < 2) {
      output.push(line);
      index++;
      continue;
    }

    const hasValidHeaderDelimiter =
      rows.length > 1 &&
      rows[1].length === firstRow.cells.length &&
      isMarkdownTableDivider(rows[1]);
    if (!hasValidHeaderDelimiter) {
      for (let rowIndex = rows.length - 1; rowIndex > 0; rowIndex--) {
        if (isMarkdownTableDivider(rows[rowIndex])) {
          rows.splice(rowIndex, 1);
        }
      }
      rows.splice(1, 0, firstRow.cells.map(() => "---"));
    }
    for (let rowIndex = rows.length - 1; rowIndex > 0; rowIndex--) {
      if (isMarkdownTableDivider(rows[rowIndex]) && rowIndex !== 1) {
        rows.splice(rowIndex, 1);
        continue;
      }
      if (rows[rowIndex].length > firstRow.cells.length) {
        const trailingCells = rows[rowIndex].splice(firstRow.cells.length - 1);
        rows[rowIndex].push(trailingCells.join(" \\| "));
      }
      while (rows[rowIndex].length < firstRow.cells.length) {
        rows[rowIndex].push(isMarkdownTableDivider(rows[rowIndex]) ? "---" : "");
      }
    }
    if (output.length && output[output.length - 1].trim()) {
      output.push("");
    }
    output.push(
      ...rows.map(row => `${firstRow.indent}| ${row.join(" | ")} |`),
    );
    if (skippedBlankLine) {
      output.push("");
    }
    index = nextIndex;
  }

  return output.join("\n");
}

function prepareMarkdownSource(source: string): string {
  return fixDoubleDollarNewLineLatex(
    patchNestedMarkdown(
      normalizeSeparatedGfmTableRows(normalizePackedGfmTableRows(source)),
    ),
  );
}

interface MarkdownFallbackSegment {
  kind: "markdown" | "table";
  source: string;
}

/** Keep GFM tables out of unrelated Markdown plugin failures in long replies. */
function splitMarkdownFallbackTables(source: string): MarkdownFallbackSegment[] {
  const lines = source.split("\n");
  const segments: MarkdownFallbackSegment[] = [];
  let markdownLines: string[] = [];
  let activeFence: { character: string; length: number } | undefined;
  const isPipeRow = (line: string) => {
    const trimmed = line.trim();
    return trimmed.startsWith("|") && trimmed.includes("|");
  };
  const isDelimiterRow = (line: string) => {
    return isMarkdownTableDivider(splitMarkdownTableRow(line));
  };
  const flushMarkdown = () => {
    if (markdownLines.length) {
      segments.push({ kind: "markdown", source: markdownLines.join("\n") });
      markdownLines = [];
    }
  };

  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    const fence = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (activeFence) {
      markdownLines.push(line);
      if (
        fence &&
        fence[1][0] === activeFence.character &&
        fence[1].length >= activeFence.length &&
        /^ {0,3}(?:`{3,}|~{3,})\s*$/.test(line)
      ) {
        activeFence = undefined;
      }
      index++;
      continue;
    }
    if (fence) {
      activeFence = { character: fence[1][0], length: fence[1].length };
      markdownLines.push(line);
      index++;
      continue;
    }

    if (
      isPipeRow(line) &&
      index + 1 < lines.length &&
      isDelimiterRow(lines[index + 1])
    ) {
      flushMarkdown();
      const tableLines = [line, lines[index + 1]];
      index += 2;
      while (index < lines.length && isPipeRow(lines[index])) {
        tableLines.push(lines[index]);
        index++;
      }
      segments.push({ kind: "table", source: tableLines.join("\n") });
      continue;
    }

    markdownLines.push(line);
    index++;
  }

  flushMarkdown();
  return segments;
}

function CommonMarkSegment({ source }: { source: string }) {
  return useRemarkSync(source, {
    rehypeReactOptions: { components: fallbackMarkdownComponents },
  });
}

function MarkdownTableCell({ source }: { source: string }) {
  return useRemarkSync(source, {
    rehypeReactOptions: { components: fallbackMarkdownComponents },
  });
}

function SafeMarkdownTable({ source }: { source: string }) {
  const rows = source.split("\n").map(splitMarkdownTableRow);
  const headers = rows[0] ?? [];
  const divider = rows[1] ?? [];
  const body = rows.slice(2).filter(row => row.some(cell => cell.length > 0));

  if (
    headers.length < 2 ||
    divider.length !== headers.length ||
    !divider.every(cell => /^\s*:?-{3,}:?\s*$/.test(cell))
  ) {
    return <p>{source}</p>;
  }

  const alignments: Array<"left" | "center" | "right" | undefined> =
    headers.map((_, index) => {
      const cell = divider[index] ?? "";
      if (cell.startsWith(":") && cell.endsWith(":")) {
        return "center";
      }
      if (cell.startsWith(":")) {
        return "left";
      }
      return cell.endsWith(":") ? "right" : undefined;
    });
  const normalizeRow = (row: string[]) =>
    row.length <= headers.length
      ? [...row, ...Array(Math.max(0, headers.length - row.length)).fill("")]
      : [...row.slice(0, headers.length - 1), row.slice(headers.length - 1).join(" | ")];

  return (
    <div className="markdown-table-scroll">
      <table className="markdown-table">
        <thead>
          <tr>
            {headers.map((cell, index) => (
              <th key={index} align={alignments[index]}>
                <MarkdownTableCell source={cell} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {normalizeRow(row).map((cell, columnIndex) => (
                <td key={columnIndex} align={alignments[columnIndex]}>
                  <MarkdownTableCell source={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CommonMarkFallback({ source }: { source: string }) {
  const segments = splitMarkdownFallbackTables(prepareMarkdownSource(source));
  return (
    <>
      {segments.map((segment, index) =>
        segment.kind === "table" ? (
          <SafeMarkdownTable key={`table-${index}`} source={segment.source} />
        ) : (
          <CommonMarkSegment key={`markdown-${index}`} source={segment.source} />
        ),
      )}
    </>
  );
}

/** Render safe CommonMark and isolated tables after a rich plugin failure. */
function MarkdownFallback({ source }: { source: string }) {
  return <CommonMarkFallback source={source} />;
}

interface StyledMarkdownPreviewProps {
  showToolCallStatusIcon?: boolean;
  source?: string;
  className?: string;
  isRenderingInStepContainer?: boolean;
  scrollLocked?: boolean;
  itemIndex?: number;
  useParentBackgroundColor?: boolean;
  disableManualApply?: boolean;
  toolCallId?: string;
  expandCodeblocks?: boolean;
  collapsible?: boolean;
  isThinking?: boolean;
}

const HLJS_LANGUAGE_CLASSNAME_PREFIX = "language-";

function getLanguageFromClassName(className: any): string | null {
  if (!className || typeof className !== "string") {
    return null;
  }

  const language = className
    .split(" ")
    .find((word) => word.startsWith(HLJS_LANGUAGE_CLASSNAME_PREFIX))
    ?.split("-")[1];

  return language ?? null;
}

function getCodeChildrenContent(children: ReactNode): string | undefined {
  if (typeof children === "string") {
    return children;
  }
  if (Array.isArray(children)) {
    return children
      .map(child => getCodeChildrenContent(child))
      .filter((child): child is string => child !== undefined)
      .join("");
  }
  return isValidElement<{ children?: ReactNode }>(children)
    ? getCodeChildrenContent(children.props.children)
    : undefined;
}

interface MarkdownCodeElementProps {
  className?: string;
  children?: ReactNode;
  "data-codeblockcontent"?: unknown;
}

function extractMermaidSource(preProps: ComponentProps<"pre">): string | null {
  const child = Array.isArray(preProps.children)
    ? preProps.children[0]
    : preProps.children;
  if (!isValidElement<MarkdownCodeElementProps>(child)) {
    return null;
  }

  const { className, children } = child.props;
  if (!className?.split(/\s+/).includes("language-mermaid")) {
    return null;
  }

  const source = child.props["data-codeblockcontent"];
  return typeof source === "string"
    ? source
    : getCodeChildrenContent(children) ?? null;
}

interface StyledMarkdownPreviewContentProps extends StyledMarkdownPreviewProps {
  codeblockStreamIds: { current: string[] };
}

function StyledMarkdownPreviewContent(
  props: StyledMarkdownPreviewContentProps,
) {
  const selectPastContextItems = useMemo(
    () => makeSelectPastContextItems(props.itemIndex),
    [props.itemIndex],
  );
  // Subscribes to this row's prior context items only, not the whole history,
  // so streaming the tail does not re-render every markdown preview.
  const pastContextItems = useAppSelector(selectPastContextItems);
  const allSymbols = useAppSelector((state) => state.session.symbols);
  const pastFileInfo = useMemo(() => {
    if (props.itemIndex === undefined) {
      return {
        symbols: [],
        rifs: [],
      };
    }
    const rifs = pastContextItems.map((item) =>
      ctxItemToRifWithContents(item, true),
    );
    const symbols = Object.entries(allSymbols)
      .filter((e) => pastContextItems.find((item) => item.uri!.value === e[0]))
      .map((f) => f[1])
      .flat();

    return {
      symbols,
      rifs,
    };
  }, [props.itemIndex, pastContextItems, allSymbols]);
  const pastFileInfoRef = useUpdatingRef(pastFileInfo);
  const itemIndexRef = useUpdatingRef(props.itemIndex);

  const codeblockStreamIds = props.codeblockStreamIds;

  const [markdownRenderFailed, setMarkdownRenderFailed] = useState(false);
  const [reactContent, setMarkdownSource] = useRemark({
    remarkPlugins: [
      remarkGfm,
      [
        remarkMath,
        {
          singleDollarTextMath: false,
        },
      ],
      () => (tree: any) => {
        const lastNode = tree.children[tree.children.length - 1];
        const lastCodeNode = lastNode?.type === "code" ? lastNode : null;

        visit(tree, "code", (node: any) => {
          if (!node.lang) {
            node.lang = "";
          } else if (node.lang.includes(".")) {
            node.lang = node.lang.split(".").slice(-1)[0];
          }

          node.data = node.data || {};
          node.data.hProperties = node.data.hProperties || {};

          node.data.hProperties["data-islastcodeblock"] = lastCodeNode === node;
          node.data.hProperties["data-codeblockcontent"] = node.value;

          if (node.meta) {
            const meta = node.meta.split(" ");
            node.data.hProperties["data-relativefilepath"] = meta[0];
            node.data.hProperties.range = meta[1];
          }
        });
      },
    ],
    rehypePlugins: ([
      rehypeKatexOnDemand(),
      rehypeHighlightPlugin(),
      () => {
        let codeBlockIndex = 0;
        return (tree: Root) => {
          visit(tree, { tagName: "pre" }, (node: any) => {
            node.properties = { "data-codeblockindex": codeBlockIndex };
            codeBlockIndex++;
          });
        };
      },
    ] as unknown) as UseRemarkOptions["rehypePlugins"],
    rehypeReactOptions: {
      components: {
        a: ({ ...aProps }) => {
          return (
            <ToolTip place="top" className="m-0 p-0" content={aProps.href}>
              <a
                href={aProps.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {aProps.children}
              </a>
            </ToolTip>
          );
        },
        table: ({ ...tableProps }) => (
          <div className="markdown-table-scroll">
            <table {...tableProps} className="markdown-table">
              {tableProps.children}
            </table>
          </div>
        ),
        th: ({ ...thProps }) => <th {...thProps}>{thProps.children}</th>,
        td: ({ ...tdProps }) => <td {...tdProps}>{tdProps.children}</td>,
        pre: ({ ...preProps }) => {
          const mermaidSource = extractMermaidSource(preProps);
          if (mermaidSource !== null) {
            return <MermaidBlock code={mermaidSource} />;
          }

          const codeBlockIndex = preProps["data-codeblockindex"];

          const preChildProps = preProps?.children?.[0]?.props ?? {};
          const { className, range } = preChildProps;

          const relativeFilePath = preChildProps["data-relativefilepath"];
          const codeBlockContent = preChildProps["data-codeblockcontent"];

          if (!props.isRenderingInStepContainer) {
            return <SyntaxHighlightedPre {...preProps} />;
          }

          const language = getLanguageFromClassName(className);

          const isLastCodeblock = preChildProps["data-islastcodeblock"];

          if (codeblockStreamIds.current[codeBlockIndex] === undefined) {
            codeblockStreamIds.current[codeBlockIndex] = uuidv4();
          }

          return (
            <StepContainerPreToolbar
              showToolCallStatusIcon={props.showToolCallStatusIcon}
              codeBlockContent={codeBlockContent}
              itemIndex={itemIndexRef.current}
              codeBlockIndex={codeBlockIndex}
              language={language}
              relativeFilepath={relativeFilePath}
              isLastCodeblock={isLastCodeblock}
              range={range}
              codeBlockStreamId={codeblockStreamIds.current[codeBlockIndex]}
              forceToolCallId={props.toolCallId}
              expanded={props.expandCodeblocks}
              disableManualApply={props.disableManualApply}
              collapsible={props.collapsible}
            >
              <SyntaxHighlightedPre {...preProps} />
            </StepContainerPreToolbar>
          );
        },
        code: ({ ...codeProps }) => {
          const content = getCodeChildrenContent(codeProps.children);

          if (content) {
            const { symbols, rifs } = pastFileInfoRef.current;

            const matchedSymbolOrFile = matchCodeToSymbolOrFile(
              content,
              symbols,
              rifs,
            );
            if (matchedSymbolOrFile) {
              if (isSymbolNotRif(matchedSymbolOrFile)) {
                return (
                  <SymbolLink content={content} symbol={matchedSymbolOrFile} />
                );
              } else {
                return <FilenameLink rif={matchedSymbolOrFile} />;
              }
            }
          }
          // Mermaid is handled at the `pre` level so it isn't wrapped in the
          // code-apply toolbar. Inline fallback kept for safety.
          if (codeProps.className?.includes("language-mermaid")) {
            const codeText = String(
              codeProps["data-codeblockcontent"] ??
                getCodeChildrenContent(codeProps.children) ??
                "",
            );
            return <MermaidBlock code={codeText} />;
          }
          return <code {...codeProps}>{codeProps.children}</code>;
        },
        img: ({ ...imgProps }) => {
          return (
            <SecureImageComponent
              src={imgProps.src}
              alt={imgProps.alt}
              title={imgProps.title}
              className={imgProps.className}
            />
          );
        },
      },
    },
    // Optional rich plugins must never make a saved assistant response vanish.
    onError: () => setMarkdownRenderFailed(true),
  });

  useEffect(() => {
    // Stream chunks can arrive faster than the browser can paint. Coalesce
    // Markdown parsing to one update per frame and keep the existing tree
    // mounted while the next version is prepared.
    const frame = window.requestAnimationFrame(() => {
      setMarkdownRenderFailed(false);
      try {
        setMarkdownSource(prepareMarkdownSource(props.source ?? ""));
      } catch {
        setMarkdownRenderFailed(true);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [props.source]);

  const uiConfig = useAppSelector(selectUIConfig);
  const codeWrapState = uiConfig?.codeWrap ? "pre-wrap" : "pre";

  return (
    <StyledMarkdown
      className={`agent-markdown ${props.className ?? ""}`}
      fontSize={getFontSize()}
      whiteSpace={codeWrapState}
      bgColor={props.useParentBackgroundColor ? "" : vscBackground}
      isThinking={props.isThinking}
      isRenderingInStepContainer={props.isRenderingInStepContainer}
    >
      {markdownRenderFailed ? (
        <MarkdownFallback source={props.source ?? ""} />
      ) : (
        reactContent
      )}
    </StyledMarkdown>
  );
}

const StyledMarkdownPreview = memo(function StyledMarkdownPreview(
  props: StyledMarkdownPreviewProps,
) {
  const codeblockStreamIds = useRef<string[]>([]);
  const source = props.source ?? "";

  return (
    <ErrorBoundary
      fallbackRender={() => (
        <ErrorBoundary
          fallback={
            <div className="whitespace-pre-wrap break-words">{source}</div>
          }
        >
          <MarkdownFallback source={source} />
        </ErrorBoundary>
      )}
    >
      <StyledMarkdownPreviewContent
        {...props}
        codeblockStreamIds={codeblockStreamIds}
      />
    </ErrorBoundary>
  );
});

export default StyledMarkdownPreview;
