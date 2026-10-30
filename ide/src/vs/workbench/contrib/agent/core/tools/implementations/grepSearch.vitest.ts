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
            return [
              "file:///workspace/app/src/first.ts",
              "8: foo match",
              "vscode-remote://ssh-remote+host/workspace/app/src/second.ts",
              "3: bar match",
            ].join("\n");
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

  it("explains when protected matches consume the search result limit", async () => {
    const result = await grepSearchImpl(
      { query: "secret" },
      {
        ide: {
          getSearchResults: async () =>
            Array.from({ length: 100 }, (_, index) =>
              [
                `file:///workspace/secrets/credential-${index}.txt`,
                "1: protected match",
              ].join("\n"),
            ).join("\n"),
        },
      } as never,
    );

    expect(result[0].content).toContain("no accessible results");
    expect(result[1].name).toBe("Truncation warning");
  });
});
