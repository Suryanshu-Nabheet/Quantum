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

  it("does not expose files in protected directories", async () => {
    const result = await fileGlobSearchImpl({ pattern: "**/*" }, {
      ide: {
        getFileResults: async () => [
          "file:///workspace/secrets/nested/credentials.txt",
          "file:///workspace/src/app.ts",
        ],
        getWorkspaceDirs: async () => ["file:///workspace"],
      },
    } as never);

    expect(result[0].content).toBe("app.ts");
    expect(result[0].content).not.toContain("credentials.txt");
  });

  it("retains the truncation notice when protected paths consume the result cap", async () => {
    const fileResults = [
      "file:///workspace/secrets/credentials.txt",
      ...Array.from(
        { length: 99 },
        (_, index) => `file:///workspace/src/file-${index}.ts`,
      ),
    ];
    const result = await fileGlobSearchImpl({ pattern: "**/*" }, {
      ide: {
        getFileResults: async () => fileResults,
        getWorkspaceDirs: async () => ["file:///workspace"],
      },
    } as never);

    expect(result).toHaveLength(2);
    expect(result[1].name).toBe("Truncation warning");
  });

  it("explains when all capped glob results are protected", async () => {
    const result = await fileGlobSearchImpl({ pattern: "**/*" }, {
      ide: {
        getFileResults: async () =>
          Array.from(
            { length: 100 },
            (_, index) =>
              `file:///workspace/secrets/credential-${index}.txt`,
          ),
        getWorkspaceDirs: async () => ["file:///workspace"],
      },
    } as never);

    expect(result[0].content).toContain("returned no results");
    expect(result[1].name).toBe("Truncation warning");
  });
});
