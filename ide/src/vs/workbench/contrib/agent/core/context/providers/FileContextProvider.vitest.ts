import { describe, expect, it } from "vitest";
import FileContextProvider, {
  resolveWorkspaceFileUris,
} from "./FileContextProvider";

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

describe("FileContextProvider security boundaries", () => {
  it("does not offer or attach files below protected directories", async () => {
    const provider = new FileContextProvider({});
    const secureFile = "file:///workspace/secrets/nested/credentials.txt";
    const ide = {
      getWorkspaceDirs: async () => ["file:///workspace"],
      getOpenFiles: async () => [secureFile, "file:///workspace/src/app.ts"],
      getFileResults: async () => [secureFile, "file:///workspace/src/app.ts"],
    };

    const items = await provider.loadSubmenuItems({ ide } as never);
    expect(items.map((item) => item.id)).toEqual([
      "file:///workspace/src/app.ts",
    ]);
    await expect(
      provider.getContextItems(secureFile, {} as never),
    ).rejects.toThrow("security concern");
  });
});
