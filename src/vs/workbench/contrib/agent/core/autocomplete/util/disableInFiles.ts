import { pathMatchesPatternList } from "../../util/pathPatternMatch";

export function isAutocompleteDisabledInFile(
  filepath: string,
  patterns: string[] | undefined,
): boolean {
  return pathMatchesPatternList(filepath, patterns);
}
