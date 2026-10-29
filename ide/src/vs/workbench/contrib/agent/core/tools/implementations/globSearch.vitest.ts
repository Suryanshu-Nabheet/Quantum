import { describe, expect, it } from "vitest";
import { fileGlobSearchImpl } from "./globSearch";

describe("fileGlobSearchImpl", () => {
  it("formats absolute multi-root results as unique workspace paths", async () => {
    const result = await fileGlobSearchImpl({ pattern: "**/index.ts" }, {
      ide: {
        getFileResults: async () => [
          "file:///workspace/app/src/index.ts",
          "file:///workspace/shared/src/index.ts",
        ],
        getWorkspaceDirs: async () => [
          "file:///workspace/app",
          "file:///workspace/shared",
        ],
      },
    } as never);

    expect(result[0].content).toBe("app/src/index.ts\nshared/src/index.ts");
  });

  it("preserves non-URI results from other IDE adapters", async () => {
    const result = await fileGlobSearchImpl({ pattern: "**/index.ts" }, {
      ide: {
        getFileResults: async () => ["src/index.ts"],
        getWorkspaceDirs: async () => ["file:///workspace/app"],
      },
    } as never);

    expect(result[0].content).toBe("src/index.ts");
  });
});
