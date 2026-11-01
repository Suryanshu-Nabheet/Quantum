import { common, createLowlight } from "lowlight";
import { useContext, type ReactNode } from "react";
import styled from "styled-components";
import { VscThemeContext } from "../context/VscTheme";

const lowlight = createLowlight(common);

const EXTENSION_LANGUAGE: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  hpp: "cpp",
  cs: "csharp",
  css: "css",
  scss: "scss",
  less: "less",
  json: "json",
  yml: "yaml",
  yaml: "yaml",
  md: "markdown",
  xml: "xml",
  html: "xml",
  htm: "xml",
  svg: "xml",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  sql: "sql",
  php: "php",
  lua: "lua",
  swift: "swift",
  graphql: "graphql",
  ini: "ini",
  toml: "ini",
};

export function languageFromPath(filepath: string | undefined): string | undefined {
  if (!filepath) {
    return undefined;
  }
  const base = filepath.split(/[/\\]/).pop() ?? "";
  const ext = base.includes(".") ? base.split(".").pop()?.toLowerCase() : "";
  if (!ext) {
    return undefined;
  }
  const language = EXTENSION_LANGUAGE[ext];
  return language && lowlight.registered(language) ? language : undefined;
}

type Segment = { className?: string; text: string };

function classNameOf(properties: { className?: string | string[] } | undefined): string | undefined {
  const value = properties?.className;
  if (!value) {
    return undefined;
  }
  return Array.isArray(value) ? value.join(" ") : value;
}

function pushText(lines: Segment[][], className: string | undefined, text: string) {
  const parts = text.split("\n");
  parts.forEach((part, index) => {
    if (part.length > 0) {
      lines[lines.length - 1].push({ className, text: part });
    }
    if (index < parts.length - 1) {
      lines.push([]);
    }
  });
}

function walk(
  node: { type?: string; value?: string; properties?: { className?: string | string[] }; children?: unknown[] },
  lines: Segment[][],
  className?: string,
) {
  if (node.type === "text") {
    pushText(lines, className, node.value ?? "");
    return;
  }
  const next =
    node.type === "element" ? classNameOf(node.properties) ?? className : className;
  for (const child of node.children ?? []) {
    walk(child as typeof node, lines, next);
  }
}

export function highlightLines(code: string, language: string | undefined): Segment[][] {
  if (!language) {
    return code.split("\n").map((text) => (text ? [{ text }] : []));
  }
  try {
    const tree = lowlight.highlight(language, code);
    const lines: Segment[][] = [[]];
    walk(tree, lines);
    return lines;
  } catch {
    return code.split("\n").map((text) => (text ? [{ text }] : []));
  }
}

const generateThemeStyles = (theme: Record<string, string>) => {
  return Object.keys(theme)
    .map((key) => `& ${key} { color: ${theme[key]}; }`)
    .join("");
};

const StyledTheme = styled.div<{ theme: Record<string, string> }>`
  ${(props) => generateThemeStyles(props.theme)}
`;

/** Applies the active Quantum editor token colors to highlight.js spans. */
export function ThemedCode({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const currentTheme = useContext(VscThemeContext);
  return (
    <StyledTheme className={className} theme={currentTheme.theme}>
      {children}
    </StyledTheme>
  );
}
