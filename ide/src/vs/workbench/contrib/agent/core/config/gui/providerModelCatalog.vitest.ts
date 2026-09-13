import { describe, expect, it } from "vitest";
import {
  catalogModelNamesForProvider,
  filterListedModelNames,
} from "./providerModelCatalog";

describe("filterListedModelNames", () => {
  it("dedupes and drops AUTODETECT", () => {
    expect(
      filterListedModelNames("ollama", [
        "llama3",
        "llama3",
        "AUTODETECT",
        "  ",
      ]),
    ).toEqual(["llama3"]);
  });

  it("filters noisy OpenAI-family listings", () => {
    const filtered = filterListedModelNames("openai", [
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
  });

  it("does not apply OpenAI filter to ollama", () => {
    expect(
      filterListedModelNames("ollama", ["nomic-embed-text", "llama3.2"]),
    ).toEqual(["nomic-embed-text", "llama3.2"]);
  });
});

describe("catalogModelNamesForProvider", () => {
  it("returns curated models for anthropic", () => {
    const names = catalogModelNamesForProvider("anthropic");
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((n) => n !== "AUTODETECT")).toBe(true);
  });

  it("returns empty for unknown provider", () => {
    expect(catalogModelNamesForProvider("not-a-real-provider")).toEqual([]);
  });
});
