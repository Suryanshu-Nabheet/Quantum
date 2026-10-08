import { FileSymbolMap, IDE, SymbolWithRange } from "..";
import { getUriFileExtension } from "./uri";

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
