import { beforeEach, describe, expect, it, vi } from "vitest";

import CommitContextProvider from "./CommitContextProvider";
import { makeGitContextId } from "./gitContextUtils";

const mockIde = {
  getWorkspaceDirs: vi.fn(),
  getGitRefs: vi.fn(),
  getBranch: vi.fn(),
  getGitHistory: vi.fn(),
  getGitCommitContext: vi.fn(),
};

const mockExtras = {
  ide: mockIde as any,
  config: {} as any,
  fullInput: "",
  embeddingsProvider: null,
  reranker: null,
  llm: {} as any,
  fetch: {} as any,
  selectedCode: [],
  isInAgentMode: false,
};

describe("CommitContextProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIde.getWorkspaceDirs.mockResolvedValue([
      "file:///Users/me/project",
    ]);
  });

  it("loads recent commit submenu items from git log", async () => {
    mockIde.getBranch.mockResolvedValue("main");
    mockIde.getGitRefs.mockResolvedValue([
      { id: "refs/heads/main", name: "main", revision: "branch-head-sha" },
    ]);
    mockIde.getGitHistory.mockResolvedValue([
      { id: "abc123", subject: "Initial commit", message: "Initial commit" },
      { id: "def456", subject: "Second commit", message: "Second commit" },
    ]);

    const provider = new CommitContextProvider({});
    const items = await provider.loadSubmenuItems({
      ide: mockIde as any,
      config: {} as any,
      fetch: fetch as any,
    });

    expect(items[0].title).toContain("last 10 commits");
    expect(
      items.some(
        (item) =>
          item.id ===
          makeGitContextId("commit", "file:///Users/me/project", "abc123"),
      ),
    ).toBe(true);
    expect(mockIde.getGitHistory).toHaveBeenCalledWith(
      "file:///Users/me/project",
      "branch-head-sha",
      50,
    );
  });

  it("returns commit show output for a selected hash", async () => {
    mockIde.getGitCommitContext.mockResolvedValue("commit metadata and diff");

    const provider = new CommitContextProvider({});
    const items = await provider.getContextItems("abc123", mockExtras);

    expect(items).toHaveLength(1);
    expect(items[0].content).toContain("commit metadata");
  });

  it("returns the recent commits shortcut when git is unavailable", async () => {
    mockIde.getBranch.mockRejectedValue(new Error("not a git repository"));

    const provider = new CommitContextProvider({});
    const items = await provider.loadSubmenuItems({
      ide: mockIde as any,
      config: {} as any,
      fetch: fetch as any,
    });

    expect(items[0].title).toContain("last 10 commits");
    expect(mockIde.getBranch).toHaveBeenCalled();
  });

  it("keeps recent commits and commit selections scoped to each workspace root", async () => {
    mockIde.getWorkspaceDirs.mockResolvedValue([
      "file:///Users/me/one",
      "file:///Users/me/two",
    ]);
    mockIde.getBranch.mockResolvedValue("main");
    mockIde.getGitRefs.mockImplementation(async (dir: string) => [
      { id: `${dir}-head`, name: "main", revision: `${dir}-head` },
    ]);
    mockIde.getGitHistory.mockImplementation(async (dir: string) => [
      { id: `${dir}-commit`, subject: "Commit", message: "Commit" },
    ]);

    const provider = new CommitContextProvider({});
    const items = await provider.loadSubmenuItems({
      ide: mockIde as any,
      config: {} as any,
      fetch: fetch as any,
    });
    expect(items.some((item) => item.title === "Commit · two")).toBe(true);
    expect(
      items.filter((item) => item.title.startsWith("last 10 commits")),
    ).toHaveLength(2);

    mockIde.getGitCommitContext.mockResolvedValue("second-root diff");
    const selected = items.find((item) => item.title === "Commit · two")!;
    const context = await provider.getContextItems(selected.id, mockExtras);
    expect(context).toHaveLength(1);
    expect(mockIde.getGitCommitContext).toHaveBeenCalledWith(
      "file:///Users/me/two",
      "file:///Users/me/two-commit",
    );
  });
});
