import {
  normalizePathPattern,
  pathMatchesPatternList,
} from "../../util/pathPatternMatch";

/** @deprecated Use normalizePathPattern */
export function normalizeAutocompleteDisablePattern(pattern: string): string {
  return normalizePathPattern(pattern);
}

export function isAutocompleteDisabledInFile(
  filepath: string,
  patterns: string[] | undefined,
): boolean {
  return pathMatchesPatternList(filepath, patterns);
}
