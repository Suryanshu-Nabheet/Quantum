import { ctxItemToRifWithContents } from "core/commands/util";
import { memo, useEffect, useMemo, useRef } from "react";
import { useRemark } from "react-remark";
import rehypeKatex from "rehype-katex";
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
import { getContextItemsFromHistory } from "../../redux/thunks/updateFileSymbols";
import { getFontSize } from "../../util";
import { ToolTip } from "../gui/Tooltip";
import FilenameLink from "./FilenameLink";
import "./agentMarkdown.css";
import "./katex.css";
import "./markdown.css";
import MermaidBlock from "./MermaidBlock";
import { rehypeHighlightPlugin } from "./rehypeHighlightPlugin";
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
    font-size: ${(props) => (props.isThinking ? "1.05em" : "1.25em")};
  }

  h2 {
    font-size: ${(props) => (props.isThinking ? "1em" : "1.15em")};
  }

  h3 {
    font-size: ${(props) => (props.isThinking ? "0.95em" : "1.05em")};
  }

  h4 {
    font-size: ${(props) => (props.isThinking ? "0.9em" : "1em")};
  }

  h5 {
    font-size: ${(props) => (props.isThinking ? "0.85em" : "0.95em")};
  }

  h6 {
    font-size: ${(props) => (props.isThinking ? "0.8em" : "0.9em")};
  }

  pre {
    white-space: ${(props) => props.whiteSpace};
    background-color: ${vscEditorBackground};
    border-radius: ${defaultBorderRadius};

    max-width: calc(100vw - 24px);
    overflow-x: scroll;
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
    font-size: ${(props) => (props.isThinking ? "0.65rem" : `${getFontSize() - 2}px`)};
    font-family: var(--vscode-editor-font-family);
  }

  ul ul,
  ul ol,
  ol ul,
  ol ol {
    padding-left: 1.5em;
    margin-top: 1em;
  }

  li {
    margin-bottom: ${(props) => (props.isThinking ? "0.5em" : "0.8em")};
  }
  li:last-child {
    margin-bottom: 0;
  }

  ul,
  ol {
    padding-left: 2em;
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
    props.isThinking ? "0.75rem" : props.fontSize ? `${props.fontSize}px` : `${getFontSize()}px`};
  padding-left: ${(props) => (props.isRenderingInStepContainer ? "0" : "8px")};
  padding-right: ${(props) => (props.isRenderingInStepContainer ? "0" : "8px")};
  color: ${(props) =>
    props.isThinking ? "var(--vscode-descriptionForeground)" : vscForeground};

  p,
  li,
  ol,
  ul {
    line-height: ${(props) => (props.isThinking ? "1.25" : "1.5")};
  }

  * {
    word-break: break-word;
  }

  > *:last-child {
    margin-bottom: 0;
  }
`;

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

function getCodeChildrenContent(children: any) {
  if (typeof children === "string") {
    return children;
  } else if (
    Array.isArray(children) &&
    children.length > 0 &&
    typeof children[0] === "string"
  ) {
    return children[0];
  }
  return undefined;
}

function extractMermaidSource(preProps: any): string | null {
  const child = preProps?.children?.[0];
  const className = child?.props?.className;
  if (
    typeof className === "string" &&
    className.includes("language-mermaid")
  ) {
    return (
      child.props["data-codeblockcontent"] ??
      getCodeChildrenContent(child.props.children) ??
      null
    );
  }
  return null;
}

const StyledMarkdownPreview = memo(function StyledMarkdownPreview(
  props: StyledMarkdownPreviewProps,
) {
  const history = useAppSelector((state) => state.session.history);
  const allSymbols = useAppSelector((state) => state.session.symbols);
  const pastFileInfo = useMemo(() => {
    const index = props.itemIndex;
    if (index === undefined) {
      return {
        symbols: [],
        rifs: [],
      };
    }
    const pastContextItems = getContextItemsFromHistory(history, index);
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
  }, [props.itemIndex, history, allSymbols]);
  const pastFileInfoRef = useUpdatingRef(pastFileInfo);
  const itemIndexRef = useUpdatingRef(props.itemIndex);

  const codeblockStreamIds = useRef<string[]>([]);

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
    rehypePlugins: [
      rehypeKatex as any,
      {},
      rehypeHighlightPlugin(),
      () => {
        let codeBlockIndex = 0;
        return (tree) => {
          visit(tree, { tagName: "pre" }, (node: any) => {
            node.properties = { "data-codeblockindex": codeBlockIndex };
            codeBlockIndex++;
          });
        };
      },
      {},
    ],
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
            <table className="markdown-table" {...tableProps}>
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
  });

  useEffect(() => {
    setMarkdownSource(
      fixDoubleDollarNewLineLatex(patchNestedMarkdown(props.source ?? "")),
    );
  }, [props.source, allSymbols]);

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
      {reactContent}
    </StyledMarkdown>
  );
});

export default StyledMarkdownPreview;
