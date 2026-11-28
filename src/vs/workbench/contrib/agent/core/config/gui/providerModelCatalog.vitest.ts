import { describe, expect, it } from "vitest";
import { filterListedModelNames } from "./providerModelCatalog";

describe("filterListedModelNames", () => {
  it("dedupes and drops AUTODETECT", () => {
    expect(
      filterListedModelNames([
        "llama3",
        "llama3",
        "AUTODETECT",
        "  ",
      ]),
    ).toEqual(["llama3"]);
  });

  it("filters noisy OpenAI-family listings", () => {
    const filtered = filterListedModelNames([
      "gpt-4o",
      "text-embedding-3-small",
      "whisper-1",
      "davinci-instruct",
      "o1-mini",
      "openrouter/auto",
    ]);
    expect(filtered).toContain("gpt-4o");
    expect(filtered).toContain("o1-mini");
    expect(filtered).toContain("openrouter/auto");
    expect(filtered).not.toContain("text-embedding-3-small");
    expect(filtered).not.toContain("whisper-1");
    expect(filtered).toContain("davinci-instruct");
  });

  it("drops embedding IDs from provider listings", () => {
    expect(filterListedModelNames(["nomic-embed-text", "llama3.2"])).toEqual([
      "llama3.2",
    ]);
  });
});
