import { describe, expect, it } from "vitest";
import { resolveWorkspaceFileUris } from "./FileContextProvider";

describe("resolveWorkspaceFileUris", () => {
  it("preserves absolute file URIs from every workspace root", () => {
    const roots = ["file:///workspace/app", "file:///workspace/shared"];
    const files = ["file:///workspace/shared/src/model.ts"];

    expect(resolveWorkspaceFileUris(files, roots)).toEqual(files);
  });

  it("keeps compatibility with root-relative results", () => {
    expect(
      resolveWorkspaceFileUris(["src/app.ts"], ["file:///workspace/app"]),
    ).toEqual(["file:///workspace/app/src/app.ts"]);
  });
});
