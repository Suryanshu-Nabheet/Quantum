import { beforeEach, describe, expect, it, vi } from "vitest";

import BranchContextProvider from "./BranchContextProvider";

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
        id: "main",
        title: "main",
        description: "abc123",
      },
      {
        id: "feature/demo",
        title: "feature/demo",
        description: "def456",
      },
      {
        id: "origin/main",
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
  });
});
