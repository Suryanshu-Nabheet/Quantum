import { describe, expect, it } from "vitest";
import {
  formatModelDisplayName,
  getModelDisplayId,
  getModelPickerProviderLabel,
  getRawModelSlug,
} from "./modelDisplay";

describe("formatModelDisplayName", () => {
  it("formats OpenRouter-style slugs with routing prefix", () => {
    expect(formatModelDisplayName("~openai/gpt-terra-latest")).toBe(
      "GPT Terra Latest",
    );
    expect(formatModelDisplayName("~deepseek/deepseek-flash-latest")).toBe(
      "DeepSeek Flash Latest",
    );
  });

  it("formats plain org/model slugs", () => {
    expect(formatModelDisplayName("aion-labs/aion-3.5")).toBe("Aion 3.5");
    expect(formatModelDisplayName("openai/gpt-5.4-mini")).toBe("GPT 5.4 Mini");
  });

  it("formats single-segment model ids", () => {
    expect(formatModelDisplayName("gpt-4o")).toBe("GPT 4o");
  });
});

describe("getModelDisplayId", () => {
  it("prefers human titles over slug-like model fields", () => {
    expect(
      getModelDisplayId({
        title: "GPT-5.4 Mini",
        model: "~openai/gpt-5.4-mini",
      }),
    ).toBe("GPT-5.4 Mini");
  });

  it("formats slug-like titles when no friendlier title exists", () => {
    expect(
      getModelDisplayId({
        title: "~z-ai/glm-latest",
        model: "~z-ai/glm-latest",
      }),
    ).toBe("GLM Latest");
  });
});

describe("getModelPickerProviderLabel", () => {
  it("shows upstream org for gateway providers", () => {
    expect(
      getModelPickerProviderLabel({
        provider: "openrouter",
        underlyingProviderName: "openrouter",
        model: "~openai/gpt-terra-latest",
        title: "~openai/gpt-terra-latest",
      }),
    ).toBe("OpenAI");
  });

  it("keeps direct provider label for non-gateway providers", () => {
    expect(
      getModelPickerProviderLabel({
        provider: "openai",
        underlyingProviderName: "openai",
        model: "gpt-4o",
        title: "GPT-4o",
      }),
    ).toBe("OpenAI");
  });
});

describe("getRawModelSlug", () => {
  it("returns model field when set", () => {
    expect(
      getRawModelSlug({
        title: "ignored",
        model: "anthropic/claude-sonnet-4",
      }),
    ).toBe("anthropic/claude-sonnet-4");
  });
});
