import { distance } from "fastest-levenshtein";

import { DiffLine } from "../../..";
import { LineStream } from "../../../diff/util";

import { headerIsMarkdown, isMarkdownFile } from "../../../utils/markdownUtils";

export { filterCodeBlockLines } from "./filterCodeBlock";

export type LineFilter = (args: {
  lines: LineStream;
  fullStop: () => void;
}) => LineStream;

export type CharacterFilter = (args: {
  chars: AsyncGenerator<string>;
  prefix: string;
  suffix: string;
  filepath: string;
  multiline: boolean;
}) => AsyncGenerator<string>;

function isBracketEnding(line: string): boolean {
  return line
    .trim()
    .split("")
    .some((char) => BRACKET_ENDING_CHARS.includes(char));
}

function isEnglishFirstLine(line: string) {
  line = line.trim().toLowerCase();

  if (
    line.endsWith(":") &&
    !CODE_KEYWORDS_ENDING_IN_SEMICOLON.some((keyword) =>
      line.startsWith(keyword),
    )
  ) {
    return true;
  }

  return ENGLISH_START_PHRASES.some((phrase) => line.startsWith(phrase));
}

function isEnglishPostExplanation(line: string): boolean {
  const lower = line.toLowerCase();
  return ENGLISH_POST_PHRASES.some((phrase) => lower.startsWith(phrase));
}

/**
 * Shared utility for validating patterns in lines to avoid code duplication.
 * Checks if a pattern appears in a valid context (not inside quotes or identifiers).
 */
export function validatePatternInLine(
  line: string,
  pattern: string,
): {
  isValid: boolean;
  patternIndex: number;
  beforePattern: string;
} {
  const patternIndex = line.indexOf(pattern);

  if (patternIndex === -1) {
    return { isValid: false, patternIndex: -1, beforePattern: "" };
  }

  // Check if pattern is preceded by a non-whitespace character
  // If so, it might be part of an identifier, so don't handle it
  if (patternIndex > 0) {
    const charBefore = line[patternIndex - 1];
    if (charBefore && !charBefore.match(/\s/)) {
      return { isValid: false, patternIndex, beforePattern: "" };
    }
  }

  // Check if pattern appears to be inside quotes
  // Simple heuristic: count unmatched quotes before the pattern
  const beforePattern = line.substring(0, patternIndex);
  const singleQuotes = (beforePattern.match(/'/g) || []).length;
  const doubleQuotes = (beforePattern.match(/"/g) || []).length;

  // If there's an odd number of quotes before pattern, we're likely inside quotes
  if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0) {
    return { isValid: false, patternIndex, beforePattern };
  }

  return { isValid: true, patternIndex, beforePattern };
}

export function shouldChangeLineAndStop(line: string): string | undefined {
  if (line.trimStart() === "```") {
    return line;
  }

  // Check if [/CODE] appears in the line
  if (line.includes(CODE_STOP_BLOCK)) {
    const validation = validatePatternInLine(line, CODE_STOP_BLOCK);

    if (!validation.isValid) {
      return undefined;
    }

    // Get the trimmed line to check if [/CODE] is at logical start
    const trimmedLine = line.trimStart();

    if (trimmedLine.startsWith(CODE_STOP_BLOCK)) {
      // [/CODE] is at the logical start (after whitespace only)
      if (trimmedLine === CODE_STOP_BLOCK) {
        return line; // Return the whole line including leading whitespace
      }
    }

    // [/CODE] appears after some content (separated by whitespace) - return part before
    return validation.beforePattern.trimEnd();
  }

  return undefined;
}

function isUselessLine(line: string): boolean {
  const trimmed = line.trim().toLowerCase();
  const hasUselessLine = USELESS_LINES.some(
    (uselessLine) => trimmed === uselessLine,
  );

  return hasUselessLine || trimmed.startsWith("// end");
}

/**
 * Determines if the code block has nested markdown blocks.
 */
export function hasNestedMarkdownBlocks(
  firstLine: string,
  filepath?: string,
): boolean {
  return (
    (firstLine.startsWith("```") &&
      headerIsMarkdown(firstLine.replace(/`/g, ""))) ||
    Boolean(filepath && isMarkdownFile(filepath))
  );
}

export const USELESS_LINES = [""];
export const CODE_KEYWORDS_ENDING_IN_SEMICOLON = ["def"];
export const CODE_STOP_BLOCK = "[/CODE]";
export const BRACKET_ENDING_CHARS = [")", "]", "}", ";"];
export const LINES_TO_STOP_AT = [
  "# End of file.",
  "<STOP EDITING HERE",
  "<|/updated_code|>",
  "```",
];
export const LINES_TO_SKIP = ["</START EDITING HERE>", "<|updated_code|>"];
export const ENGLISH_START_PHRASES = [
  "here is",
  "here's",
  "sure, here",
  "sure thing",
  "sure!",
  "to fill",
  "certainly",
  "of course",
  "the code should",
];

export const ENGLISH_POST_PHRASES = [
  "explanation:",
  "here is",
  "here's how",
  "the above",
];

/**
 * Determines if two lines of text are considered repeated or very similar.
 *
 * @param {string} a - The first line of text to compare.
 * @param {string} b - The second line of text to compare.
 * @returns {boolean} True if the lines are considered repeated, false otherwise.
 *
 * @description
 * This function checks if the Levenshtein distance between them is less than 10% of the length of the second line.
 * Lines shorter than 5 characters are never considered repeated.
 */
export function lineIsRepeated(a: string, b: string): boolean {
  if (a.length <= 4 || b.length <= 4) {
    return false;
  }

  const aTrim = a.trim();
  const bTrim = b.trim();
  return distance(aTrim, bTrim) / bTrim.length < 0.1;
}

/**
 * Filters a LineStream, stopping when a line contains any of the specified stop phrases.
 * @param {LineStream} stream - The input stream of lines.
 * @param {() => void} fullStop - Function to call when stopping.
 * @yields {string} Filtered lines until a stop phrase is encountered.
 */
export async function* stopAtLines(
  stream: LineStream,
  fullStop: () => void,
  linesToStopAt: string[] = LINES_TO_STOP_AT,
): LineStream {
  for await (const line of stream) {
    let shouldStop = false;

    // Check each stop phrase
    for (const stopAt of linesToStopAt) {
      if (line.includes(stopAt)) {
        const validation = validatePatternInLine(line, stopAt);

        if (!validation.isValid) {
          continue;
        }

        // Get the trimmed line to check if stop phrase is at logical start
        const trimmedLine = line.trimStart();

        if (trimmedLine.startsWith(stopAt)) {
          // Stop phrase is at the logical start (after whitespace only) - should stop
          shouldStop = true;
          break;
        } else {
          // Stop phrase appears after some content - check if it's separated by whitespace
          const contentBeforeStopPhrase = validation.beforePattern.trimEnd();
          if (
            contentBeforeStopPhrase.length < validation.beforePattern.length
          ) {
            // There's whitespace before the stop phrase, so it's properly separated
            shouldStop = true;
            break;
          }
          // If no whitespace separation, it's part of larger text — keep scanning
        }
      }
    }

    if (shouldStop) {
      fullStop();
      break;
    }
    yield line;
  }
}

/**
 * Filters out lines starting with specified prefixes from a LineStream.
 * @param {LineStream} stream - The input stream of lines.
 * @yields {string} Filtered lines that don't start with any of the LINES_TO_SKIP prefixes.
 */
export async function* skipLines(stream: LineStream): LineStream {
  for await (const line of stream) {
    if (!LINES_TO_SKIP.some((skipAt) => line.startsWith(skipAt))) {
      yield line;
    }
  }
}

/**
 * Handles cases where original lines have a trailing whitespace, but new lines do not.
 * @param {LineStream} stream - The input stream of lines.
 * @yields {string} Filtered lines that are stripped of trailing whitespace
 */
export async function* removeTrailingWhitespace(
  stream: LineStream,
): LineStream {
  for await (const line of stream) {
    yield line.trimEnd();
  }
}

/**
 * Filters out English explanations at the start of a code block.
 *
 * @param {LineStream} lines - The input stream of lines.
 * @yields {string} Filtered lines with English explanations removed from the start.
 *
 * @description
 * This generator function performs the following tasks:
 * 1. Skips initial blank lines.
 * 2. Removes the first line if it's identified as an English explanation.
 * 3. Removes a subsequent blank line if the first line was an English explanation.
 * 4. Yields all remaining lines.
 */
export async function* filterEnglishLinesAtStart(lines: LineStream) {
  let i = 0;
  let wasEnglishFirstLine = false;
  for await (const line of lines) {
    if (i === 0 && line.trim() === "") {
      continue;
    }

    if (i === 0) {
      if (isEnglishFirstLine(line)) {
        wasEnglishFirstLine = true;
        i++;
        continue;
      }
    } else if (i === 1 && wasEnglishFirstLine && line.trim() === "") {
      i++;
      continue;
    }
    i++;
    yield line;
  }
}

/**
 * Filters out English explanations at the end of a code block.
 * @param {LineStream} lines - The input stream of lines.
 * @yields {string} Lines up to the end of the code block or start of English explanation.
 */
export async function* filterEnglishLinesAtEnd(lines: LineStream) {
  let finishedCodeBlock = false;

  for await (const line of lines) {
    if (line.trim() === "```") {
      finishedCodeBlock = true;
    }
    if (finishedCodeBlock && isEnglishPostExplanation(line)) {
      break;
    }
    yield line;
  }
}

export async function* filterLeadingNewline(lines: LineStream): LineStream {
  let firstLine = true;
  for await (const line of lines) {
    if (firstLine && line.trim() === "") {
      firstLine = false;
      continue;
    }
    yield line;
  }
}

/**
 * Removes leading indentation from the first line of a CodeLlama output.
 * @param {LineStream} lines - The input stream of lines.
 * @yields {string} Lines with the first line's indentation fixed if necessary.
 */
/**
 * Filters leading and trailing blank line insertions from a stream of diff lines.
 *
 * @param {AsyncGenerator<DiffLine>} diffLines - An async generator that yields DiffLine objects.
 * @yields {DiffLine} Filtered DiffLine objects, with leading and trailing blank line insertions removed.
 *
 * @description
 * This generator function processes a stream of diff lines, removing leading and trailing
 * blank line insertions. It performs the following tasks:
 * 1. Skips the first blank line insertion if it occurs at the beginning.
 * 2. Buffers subsequent blank line insertions.
 * 3. Yields buffered blank lines when a non-blank insertion is encountered.
 * 4. Clears the buffer when an old line is encountered.
 * 5. Yields all non-blank insertions and old lines.
 */
export async function* filterLeadingAndTrailingNewLineInsertion(
  diffLines: AsyncGenerator<DiffLine>,
): AsyncGenerator<DiffLine> {
  let isFirst = true;
  let buffer: DiffLine[] = [];

  for await (const diffLine of diffLines) {
    const isBlankLineInsertion =
      diffLine.type === "new" && isUselessLine(diffLine.line);

    if (isFirst && isBlankLineInsertion) {
      isFirst = false;
      continue;
    }

    isFirst = false;

    if (isBlankLineInsertion) {
      buffer.push(diffLine);
    } else {
      if (diffLine.type === "old") {
        buffer = [];
      } else {
        while (buffer.length > 0) {
          yield buffer.shift()!;
        }
      }
      yield diffLine;
    }
  }
}

/**
 * Pass-through, except logs the total output at the end
 * @param lines a `LineStream`
 */
