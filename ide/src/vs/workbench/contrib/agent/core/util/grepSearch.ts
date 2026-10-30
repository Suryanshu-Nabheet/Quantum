import { isSecurityConcern } from "../indexing/ignore";

/*
  Formats the output of a grep search to reduce unnecessary indentation, lines, etc
  Assumes a command with these params
    ripgrep -i --ignore-file .agentignore --ignore-file .gitignore -C 2 --heading -m 100 -e <query> .
  
  Also can truncate the output to a specified number of characters
*/
export function isGrepSearchFileHeader(line: string): boolean {
  return (
    line.startsWith("./") ||
    /^(?:file|vscode-[a-z\d-]+):\/\/\S+$/i.test(line)
  );
}

export function formatGrepSearchResults(
  results: string,
  maxChars?: number,
): {
  formatted: string;
  numResults: number;
  numFiles: number;
  truncated: boolean;
} {
  let numResults = 0;
  let numFiles = 0;
  const keepLines: string[] = [];

  function countLeadingSpaces(line: string) {
    return line?.match(/^ */)?.[0].length ?? 0;
  }

  const processResult = (lines: string[]) => {
    const resultPath = lines[0];
    const resultContent = lines.slice(1);
    if (!resultPath || resultContent.length === 0) {
      return;
    }

    numFiles++;
    if (isSecurityConcern(resultPath)) {
      return;
    }

    numResults++;
    // Add path
    keepLines.push(resultPath);

    // Find the minimum indentation of content lines
    let minIndent = Infinity;
    for (const line of resultContent) {
      const indent = countLeadingSpaces(line);
      if (indent < minIndent) {
        minIndent = indent;
      }
    }

    // Make all lines line up to 2-space indent
    const changeIndentBy = 2 - minIndent;
    if (changeIndentBy === 0) {
      keepLines.push(...resultContent);
    } else if (changeIndentBy < 0) {
      keepLines.push(
        ...resultContent.map((line) => line.substring(-changeIndentBy)),
      );
    } else {
      keepLines.push(
        ...resultContent.map((line) => " ".repeat(changeIndentBy) + line),
      );
    }
  };

  let resultLines: string[] = [];
  for (const line of results.split("\n").filter((l) => !!l)) {
    if (line === "--") {
      // Ripgrep uses this to separate distant match groups in the same file.
      continue;
    }
    if (isGrepSearchFileHeader(line)) {
      processResult(resultLines);
      resultLines = [line];
      continue;
    }

    // Exclude leading zero- or single-char lines
    if (resultLines.length === 1 && line.trim().length <= 1) {
      continue;
    }

    resultLines.push(line);
  }
  processResult(resultLines);

  const formatted = keepLines.join("\n");
  if (maxChars && formatted.length > maxChars) {
    return {
      formatted: formatted.substring(0, maxChars),
      numResults,
      numFiles,
      truncated: true,
    };
  } else {
    return {
      formatted,
      numResults,
      numFiles,
      truncated: false,
    };
  }
}
