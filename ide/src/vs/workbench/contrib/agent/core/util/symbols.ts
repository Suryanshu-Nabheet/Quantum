import { FileSymbolMap, IDE, SymbolWithRange } from "..";
import { getUriFileExtension } from "./uri";

export enum LanguageName {
  CPP = "cpp",
  C_SHARP = "c_sharp",
  C = "c",
  CSS = "css",
  PHP = "php",
  BASH = "bash",
  JSON = "json",
  TYPESCRIPT = "typescript",
  TSX = "tsx",
  ELM = "elm",
  JAVASCRIPT = "javascript",
  PYTHON = "python",
  ELISP = "elisp",
  ELIXIR = "elixir",
  GO = "go",
  EMBEDDED_TEMPLATE = "embedded_template",
  HTML = "html",
  JAVA = "java",
  LUA = "lua",
  OCAML = "ocaml",
  QL = "ql",
  RESCRIPT = "rescript",
  RUBY = "ruby",
  RUST = "rust",
  SYSTEMRDL = "systemrdl",
  TOML = "toml",
  SOLIDITY = "solidity",
}

export const supportedLanguages: { [key: string]: LanguageName } = {
  cpp: LanguageName.CPP,
  hpp: LanguageName.CPP,
  cc: LanguageName.CPP,
  cxx: LanguageName.CPP,
  hxx: LanguageName.CPP,
  cp: LanguageName.CPP,
  hh: LanguageName.CPP,
  inc: LanguageName.CPP,
  cs: LanguageName.C_SHARP,
  c: LanguageName.C,
  h: LanguageName.C,
  css: LanguageName.CSS,
  php: LanguageName.PHP,
  phtml: LanguageName.PHP,
  bash: LanguageName.BASH,
  sh: LanguageName.BASH,
  json: LanguageName.JSON,
  ts: LanguageName.TYPESCRIPT,
  mts: LanguageName.TYPESCRIPT,
  cts: LanguageName.TYPESCRIPT,
  tsx: LanguageName.TSX,
  js: LanguageName.JAVASCRIPT,
  jsx: LanguageName.JAVASCRIPT,
  mjs: LanguageName.JAVASCRIPT,
  cjs: LanguageName.JAVASCRIPT,
  py: LanguageName.PYTHON,
  pyw: LanguageName.PYTHON,
  pyi: LanguageName.PYTHON,
  ex: LanguageName.ELIXIR,
  exs: LanguageName.ELIXIR,
  go: LanguageName.GO,
  html: LanguageName.HTML,
  htm: LanguageName.HTML,
  java: LanguageName.JAVA,
  lua: LanguageName.LUA,
  rb: LanguageName.RUBY,
  rs: LanguageName.RUST,
  toml: LanguageName.TOML,
  sol: LanguageName.SOLIDITY,
};

export const IGNORE_PATH_PATTERNS: Partial<Record<LanguageName, RegExp[]>> = {
  [LanguageName.TYPESCRIPT]: [/.*node_modules/],
  [LanguageName.JAVASCRIPT]: [/.*node_modules/],
};

export const getFullLanguageName = (filepath: string) => {
  const extension = getUriFileExtension(filepath);
  return supportedLanguages[extension];
};

const SYMBOL_PATTERNS: RegExp[] = [
  /^\s*(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/,
  /^\s*(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/,
  /^\s*(?:export\s+)?type\s+([A-Za-z_$][\w$]*)/,
  /^\s*(?:export\s+)?enum\s+([A-Za-z_$][\w$]*)/,
  /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/,
  /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/,
  /^\s*(?:public\s+|private\s+|protected\s+|static\s+|async\s+)*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::[^{]+)?\{/,
  /^\s*def\s+([A-Za-z_]\w*)\s*\(/,
  /^\s*class\s+([A-Za-z_]\w*)/,
  /^\s*func\s+([A-Za-z_]\w*)\s*\(/,
  /^\s*fn\s+([A-Za-z_]\w*)/,
];

function indentation(line: string): number {
  return line.length - line.trimStart().length;
}

function findSymbolEnd(lines: string[], startLine: number): number {
  const startIndent = indentation(lines[startLine] ?? "");
  for (let i = startLine + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      continue;
    }
    if (indentation(line) <= startIndent && SYMBOL_PATTERNS.some((pattern) => pattern.test(line))) {
      return i - 1;
    }
  }
  return Math.min(lines.length - 1, startLine + 80);
}

export async function getSymbolsForFile(
  filepath: string,
  contents: string,
): Promise<SymbolWithRange[] | undefined> {
  const lines = contents.split("\n");
  const symbols: SymbolWithRange[] = [];

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
    const line = lines[lineNumber];
    const match = SYMBOL_PATTERNS.map((pattern) => pattern.exec(line)).find(Boolean);
    const name = match?.[1];
    if (!name) {
      continue;
    }

    const endLine = findSymbolEnd(lines, lineNumber);
    symbols.push({
      filepath,
      type: "symbol",
      name,
      range: {
        start: { line: lineNumber, character: indentation(line) },
        end: {
          line: endLine,
          character: lines[endLine]?.length ?? 0,
        },
      },
      content: lines.slice(lineNumber, endLine + 1).join("\n"),
    });
  }

  return symbols;
}

export async function getSymbolsForManyFiles(
  uris: string[],
  ide: IDE,
): Promise<FileSymbolMap> {
  const filesAndSymbols = await Promise.all(
    uris.map(async (uri): Promise<[string, SymbolWithRange[]]> => {
      try {
        const contents = await ide.readFile(uri);
        return [uri, (await getSymbolsForFile(uri, contents)) ?? []];
      } catch (e) {
        console.error(`Failed to get symbols for ${uri}:`, e);
        return [uri, []];
      }
    }),
  );
  return Object.fromEntries(filesAndSymbols);
}
