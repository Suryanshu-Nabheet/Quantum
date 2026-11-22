import { describe, expect, it } from "vitest";
import { IDE_NAME } from "../util/branding";
import {
  buildAssistantIdentityBlock,
  DEFAULT_AGENT_SYSTEM_MESSAGE,
} from "./defaultSystemMessages";

describe("buildAssistantIdentityBlock", () => {
  it("keeps model metadata available without volunteering technical details", () => {
    const block = buildAssistantIdentityBlock(
      {
        modelName: "Claude Sonnet 4",
      },
      "agent",
    );

    expect(block).toContain("Claude Sonnet 4");
    expect(block).toContain("Agent mode");
    expect(block).toContain(IDE_NAME);
    expect(block).toContain("Do not volunteer the model name, provider, model identifier");
    expect(block).not.toContain("I'm Claude Sonnet 4");
    expect(block).toContain("reading and editing files");
    expect(block).toContain("do not claim to be a separate website");
  });

  it("identifies Quantum without inventing missing model metadata", () => {
    const block = buildAssistantIdentityBlock({}, "chat");

    expect(block).toContain("You are Quantum's AI assistant in Chat mode");
    expect(block).toContain("Chat mode");
    expect(block).not.toContain("Runtime model metadata");
  });

  it("does not alter mode-specific default messages", () => {
    expect(DEFAULT_AGENT_SYSTEM_MESSAGE).toContain("You are in agent mode");
    expect(DEFAULT_AGENT_SYSTEM_MESSAGE).toContain("call tools yourself");
  });
});
