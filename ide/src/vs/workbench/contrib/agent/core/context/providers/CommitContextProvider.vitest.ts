import { beforeEach, describe, expect, it, vi } from "vitest";

import CommitContextProvider from "./CommitContextProvider";

const mockIde = {
  getWorkspaceDirs: vi.fn(),
  subprocess: vi.fn(),
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
    mockIde.subprocess.mockResolvedValue([
      'abc123\0Initial commit\n' + 'def456\0Second commit',
      "",
    ]);

    const provider = new CommitContextProvider({});
    const items = await provider.loadSubmenuItems({
      ide: mockIde as any,
      config: {} as any,
      fetch: fetch as any,
    });

    expect(items[0].title).toContain("last 10 commits");
    expect(items.some((item) => item.id === "abc123")).toBe(true);
    expect(mockIde.subprocess).toHaveBeenCalled();
  });

  it("returns commit show output for a selected hash", async () => {
    mockIde.subprocess.mockResolvedValue(["commit metadata and diff", ""]);

    const provider = new CommitContextProvider({});
    const items = await provider.getContextItems("abc123", mockExtras);

    expect(items).toHaveLength(1);
    expect(items[0].content).toContain("commit metadata");
  });

  it("returns the recent commits shortcut when git is unavailable", async () => {
    mockIde.subprocess.mockRejectedValue(new Error("not a git repository"));

    const provider = new CommitContextProvider({});
    const items = await provider.loadSubmenuItems({
      ide: mockIde as any,
      config: {} as any,
      fetch: fetch as any,
    });

    expect(items[0].title).toContain("last 10 commits");
    expect(mockIde.subprocess).toHaveBeenCalled();
  });
});
