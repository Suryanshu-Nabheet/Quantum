import { describe, test, expect } from "vitest";

import { myersDiff } from "../../diff/myers";
import { dedent } from "../../util";
import { deterministicApplyLazyEdit, isLazyText } from "./deterministic";

const original = dedent`
    function test() {
        return 1;
    }

    function test2(a) {
        return a * 2;
    }
`;

describe("deterministicApplyLazyEdit", () => {
  test("returns all-same lines when nothing changed", async () => {
    const diff = await deterministicApplyLazyEdit({
      oldFile: original,
      newLazyFile: original,
      filename: "test.js",
    });

    expect(diff).toEqual(
      original.split("\n").map((line) => ({ line, type: "same" })),
    );
  });

  test("defers to the model when the new file contains lazy markers", async () => {
    const lazy = dedent`
        function test() {
            return 2;
        }

        // ... existing code ...
    `;

    expect(isLazyText(lazy)).toBe(true);
    expect(
      await deterministicApplyLazyEdit({
        oldFile: original,
        newLazyFile: lazy,
        filename: "test.js",
      }),
    ).toBeUndefined();
  });

  test("rejects rewrites that remove too much of the file", async () => {
    expect(
      await deterministicApplyLazyEdit({
        oldFile: original,
        newLazyFile: "function test() {}",
        filename: "test.js",
      }),
    ).toBeUndefined();
  });

  test("returns the line diff for a small complete edit", async () => {
    const edited = original.replace("return a * 2;", "return a * 3;");

    expect(
      await deterministicApplyLazyEdit({
        oldFile: original,
        newLazyFile: edited,
        filename: "test.js",
      }),
    ).toEqual(myersDiff(original, edited));
  });
});
