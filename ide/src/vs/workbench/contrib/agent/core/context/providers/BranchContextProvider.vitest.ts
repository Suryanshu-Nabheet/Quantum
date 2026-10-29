import { beforeEach, describe, expect, it, vi } from "vitest";

import BranchContextProvider from "./BranchContextProvider";
import { makeGitContextId } from "./gitContextUtils";

const mockIde = {
  getWorkspaceDirs: vi.fn(),
  getGitRefs: vi.fn(),
  getBranch: vi.fn(),
  getGitHistory: vi.fn(),
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

describe("BranchContextProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIde.getWorkspaceDirs.mockResolvedValue([
      "file:///Users/me/project",
    ]);
  });

  it("loads local and remote branches", async () => {
    mockIde.getGitRefs.mockResolvedValue([
      { id: "main", name: "main", revision: "abc123" },
      { id: "feature/demo", name: "feature/demo", revision: "def456" },
      { id: "origin/main", name: "origin/main", revision: "fed321" },
    ]);

    const provider = new BranchContextProvider({});
    const items = await provider.loadSubmenuItems({
      ide: mockIde as any,
      config: {} as any,
      fetch: fetch as any,
    });

    expect(items).toEqual([
      {
        id: makeGitContextId("branch", "file:///Users/me/project", "main"),
        title: "main",
        description: "abc123",
      },
      {
        id: makeGitContextId("branch", "file:///Users/me/project", "feature/demo"),
        title: "feature/demo",
        description: "def456",
      },
      {
        id: makeGitContextId("branch", "file:///Users/me/project", "origin/main"),
        title: "origin/main",
        description: "fed321",
      },
    ]);
  });

  it("returns branch log and diff context", async () => {
    mockIde.getGitRefs.mockResolvedValue([
      { id: "feature/demo", name: "feature/demo", revision: "def456" },
    ]);
    mockIde.getBranch.mockResolvedValue("main");
    mockIde.getGitHistory.mockResolvedValue([
      { id: "abc123", subject: "commit message", message: "commit message" },
    ]);

    const provider = new BranchContextProvider({});
    const items = await provider.getContextItems("feature/demo", mockExtras);

    expect(items).toHaveLength(1);
    expect(items[0].content).toContain("Branch: feature/demo");
    expect(items[0].content).toContain("Current branch: main");
    expect(items[0].content).toContain("abc123 commit message");
    expect(mockIde.getGitHistory).toHaveBeenCalledWith(
      "file:///Users/me/project",
      "def456",
      30,
    );
  });

  it("lists and resolves branches from every workspace root", async () => {
    mockIde.getWorkspaceDirs.mockResolvedValue([
      "file:///Users/me/one",
      "file:///Users/me/two",
    ]);
    mockIde.getGitRefs.mockImplementation(async (dir: string) => [
      { id: `${dir}-main`, name: "main", revision: `${dir}-head` },
    ]);
    mockIde.getBranch.mockResolvedValue("main");
    mockIde.getGitHistory.mockResolvedValue([]);

    const provider = new BranchContextProvider({});
    const submenu = await provider.loadSubmenuItems({
      ide: mockIde as any,
      config: {} as any,
      fetch: fetch as any,
    });
    expect(submenu.map((item) => item.title)).toEqual([
      "main · one",
      "main · two",
    ]);

    const context = await provider.getContextItems(submenu[1].id, mockExtras);
    expect(context).toHaveLength(1);
    expect(context[0].name).toBe("main (two)");
    expect(mockIde.getGitRefs).toHaveBeenLastCalledWith("file:///Users/me/two");
  });
});
