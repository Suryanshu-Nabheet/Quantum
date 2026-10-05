import { minimatch } from "minimatch";
import path from "path";

/** Normalize user-facing patterns (e.g. `.env`) for glob matching. */
export function normalizeAutocompleteDisablePattern(pattern: string): string {
  const trimmed = pattern.trim();
  if (!trimmed) {
    return "";
  }
  if (
    !trimmed.includes("*") &&
    !trimmed.includes("/") &&
    !trimmed.includes("\\") &&
    trimmed.startsWith(".")
  ) {
    return `**/${trimmed}`;
  }
  return trimmed.replace(/\\/g, "/");
}

export function isAutocompleteDisabledInFile(
  filepath: string,
  patterns: string[] | undefined,
): boolean {
  if (!patterns?.length) {
    return false;
  }
  const base = path.basename(filepath);
  const normalized = filepath.replace(/\\/g, "/");
  for (const raw of patterns) {
    const pattern = normalizeAutocompleteDisablePattern(raw);
    if (!pattern) {
      continue;
    }
    const opts = { dot: true, nocase: false };
    if (
      minimatch(base, pattern, opts) ||
      minimatch(normalized, pattern, opts)
    ) {
      return true;
    }
  }
  return false;
}
