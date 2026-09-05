import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDiffsFromCache } from "../../autocomplete/snippets/gitDiffCache";
import DiffContextProvider from "./DiffContextProvider";

vi.mock("../../autocomplete/snippets/gitDiffCache", () => ({
  getDiffsFromCache: vi.fn(),
}));

const mockExtras = {
  ide: {} as any,
  config: {} as any,
  fullInput: "",
  embeddingsProvider: null,
  reranker: null,
  llm: {} as any,
  fetch: {} as any,
  selectedCode: [],
  isInAgentMode: false,
};

describe("DiffContextProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses diff cache with includeUnstaged enabled by default", async () => {
    vi.mocked(getDiffsFromCache).mockResolvedValue(["diff --git a/foo.ts"]);

    const provider = new DiffContextProvider({});
    const items = await provider.getContextItems("", mockExtras);

    expect(getDiffsFromCache).toHaveBeenCalledWith(expect.anything(), true);
    expect(items[0].content).toContain("diff --git a/foo.ts");
  });

  it("respects includeUnstaged=false provider option", async () => {
    vi.mocked(getDiffsFromCache).mockResolvedValue([]);

    const provider = new DiffContextProvider({ includeUnstaged: false });
    await provider.getContextItems("", mockExtras);

    expect(getDiffsFromCache).toHaveBeenCalledWith(expect.anything(), false);
  });
});
