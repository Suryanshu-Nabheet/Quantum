import { describe, expect, it } from "vitest";
import { grepSearchImpl } from "./grepSearch";

describe("grepSearchImpl", () => {
  it("preserves the regex query and splits native URI results by file", async () => {
    let receivedQuery = "";
    let receivedRegExp = false;
    const result = await grepSearchImpl(
      { query: "foo|bar", splitByFile: true },
      {
        ide: {
          getSearchResults: async (
            query: string,
            _maxResults?: number,
            isRegExp?: boolean,
          ) => {
            receivedQuery = query;
            receivedRegExp = isRegExp === true;
            return {
              content: [
                "file:///workspace/app/src/first.ts",
                "8: foo match",
                "vscode-remote://ssh-remote+host/workspace/app/src/second.ts",
                "3: bar match",
              ].join("\n"),
              limitHit: false,
            };
          },
        },
      } as never,
    );

    expect(receivedQuery).toBe("foo|bar");
    expect(receivedRegExp).toBe(true);
    expect(result).toHaveLength(2);
    expect(result[0].uri?.value).toBe("file:///workspace/app/src/first.ts");
    expect(result[0].content).toContain("8: foo match");
    expect(result[1].uri?.value).toBe(
      "vscode-remote://ssh-remote+host/workspace/app/src/second.ts",
    );
    expect(result[1].content).toContain("3: bar match");
  });

  it("exposes the split-by-file option in the public tool schema", async () => {
    const { grepSearchTool } = await import("../definitions/grepSearch");
    expect(grepSearchTool.function.parameters.properties).toHaveProperty(
      "splitByFile",
    );
  });

  it("explains when protected matches consume the search result limit", async () => {
    const result = await grepSearchImpl(
      { query: "secret" },
      {
        ide: {
          getSearchResults: async () => ({
            content: Array.from({ length: 100 }, (_, index) =>
              [
                `file:///workspace/secrets/credential-${index}.txt`,
                "1: protected match",
              ].join("\n"),
            ).join("\n"),
            limitHit: true,
          }),
        },
      } as never,
    );

    expect(result[0].content).toContain(
      "All 100 matching files were excluded",
    );
    expect(result[1].name).toBe("Truncation warning");
  });

  it("uses the workbench limit flag instead of inferring truncation from count", async () => {
    const run = async (limitHit: boolean) =>
      grepSearchImpl(
        { query: "match" },
        {
          ide: {
            getSearchResults: async () => ({
              content: ["file:///workspace/src/a.ts", "1: match"].join("\n"),
              limitHit,
            }),
          },
        } as never,
      );

    expect(
      (await run(false)).some((item) => item.name === "Truncation warning"),
    ).toBe(false);
    expect(
      (await run(true)).some((item) => item.name === "Truncation warning"),
    ).toBe(true);
  });

  it("reports excluded protected matches alongside accessible results", async () => {
    const result = await grepSearchImpl(
      { query: "match" },
      {
        ide: {
          getSearchResults: async () => ({
            content: [
              "file:///workspace/secrets/token.txt",
              "1: private match",
              "file:///workspace/src/app.ts",
              "1: public match",
            ].join("\n"),
            limitHit: false,
          }),
        },
      } as never,
    );

    expect(result[0].content).toContain("public match");
    expect(
      result.some((item) =>
        item.content.includes("1 matching file was excluded"),
      ),
    ).toBe(true);
  });
});
