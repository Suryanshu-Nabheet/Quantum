import { beforeEach, describe, expect, it, vi } from "vitest";

import BranchContextProvider from "./BranchContextProvider";

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

describe("BranchContextProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIde.getWorkspaceDirs.mockResolvedValue([
      "file:///Users/me/project",
    ]);
  });

  it("loads local and remote branches", async () => {
    mockIde.subprocess.mockResolvedValue([
      "main\0abc123\nfeature/demo\0def456\norigin/main\0fed321",
      "",
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
    mockIde.subprocess
      .mockResolvedValueOnce(["main", ""])
      .mockResolvedValueOnce(["abc123 commit message", ""])
      .mockResolvedValueOnce([" src/file.ts | 2 +-", ""]);

    const provider = new BranchContextProvider({});
    const items = await provider.getContextItems("feature/demo", mockExtras);

    expect(items).toHaveLength(1);
    expect(items[0].content).toContain("Branch: feature/demo");
    expect(items[0].content).toContain("Current branch: main");
    expect(items[0].content).toContain("abc123 commit message");
    expect(items[0].content).toContain("src/file.ts");
  });
});
