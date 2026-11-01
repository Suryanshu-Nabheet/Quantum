import { describe, expect, it } from "vitest";
import { getWorkspaceFolderUris } from "./FolderContextProvider";

describe("getWorkspaceFolderUris", () => {
  it("derives folders from the correct root for multi-root results", () => {
    expect(
      getWorkspaceFolderUris(
        ["file:///workspace/shared/packages/agent/index.ts"],
        ["file:///workspace/app", "file:///workspace/shared"],
      ),
    ).toEqual([
      "file:///workspace/app",
      "file:///workspace/shared",
      "file:///workspace/shared/packages",
      "file:///workspace/shared/packages/agent",
    ]);
  });

  it("resolves legacy relative results against the first root", () => {
    expect(
      getWorkspaceFolderUris(
        ["src/features/index.ts"],
        ["file:///workspace/app"],
      ),
    ).toEqual([
      "file:///workspace/app",
      "file:///workspace/app/src",
      "file:///workspace/app/src/features",
    ]);
  });
});
