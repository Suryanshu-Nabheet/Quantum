import { describe, expect, it } from "vitest";
import {
  makeGitContextId,
  parseGitContextId,
  workspaceLabel,
} from "./gitContextUtils";

describe("git context identifiers", () => {
  it("round-trips paths and refs containing URL-reserved characters", () => {
    const id = makeGitContextId(
      "branch",
      "vscode-remote://ssh-remote+dev/work space/repo",
      "feature/a:b",
    );
    expect(parseGitContextId(id, "branch")).toEqual({
      dir: "vscode-remote://ssh-remote+dev/work space/repo",
      id: "feature/a:b",
    });
    expect(parseGitContextId(id, "commit")).toBeUndefined();
  });

  it("qualifies duplicate workspace folder names", () => {
    expect(
      workspaceLabel("file:///work/one/app", [
        "file:///work/one/app",
        "file:///work/two/app",
      ]),
    ).toBe("one/app");
    expect(
      workspaceLabel("file:///a/one/app", [
        "file:///a/one/app",
        "file:///b/one/app",
      ]),
    ).toBe("file:///a/one/app");
  });
});
