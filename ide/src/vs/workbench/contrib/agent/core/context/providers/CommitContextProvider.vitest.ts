import { beforeEach, describe, expect, it, vi } from "vitest";

import CommitContextProvider from "./CommitContextProvider";

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
    expect(items.some((item) => item.id === "abc123")).toBe(true);
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
});
