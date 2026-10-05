import { describe, expect, it } from "vitest";
import {
  isAutocompleteDisabledInFile,
  normalizeAutocompleteDisablePattern,
} from "./disableInFiles.js";

describe("disableInFiles", () => {
  it("normalizes bare dotfiles to match in any directory", () => {
    expect(normalizeAutocompleteDisablePattern(".env")).toBe("**/.env");
  });

  it("matches .env at repo root and nested paths", () => {
    const patterns = [".env"];
    expect(isAutocompleteDisabledInFile("/proj/.env", patterns)).toBe(true);
    expect(isAutocompleteDisabledInFile("/proj/apps/api/.env", patterns)).toBe(
      true,
    );
    expect(isAutocompleteDisabledInFile("/proj/src/index.ts", patterns)).toBe(
      false,
    );
  });

  it("honors explicit globs", () => {
    const patterns = ["**/*.md"];
    expect(isAutocompleteDisabledInFile("/proj/readme.md", patterns)).toBe(
      true,
    );
    expect(isAutocompleteDisabledInFile("/proj/readme.ts", patterns)).toBe(
      false,
    );
  });
});
