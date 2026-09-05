import { describe, expect, it } from "vitest";
import { IDE_NAME } from "../util/branding";
import {
  buildAssistantIdentityBlock,
  DEFAULT_AGENT_SYSTEM_MESSAGE,
} from "./defaultSystemMessages";

describe("buildAssistantIdentityBlock", () => {
  it("includes model name, mode, and Quantum when title is provided", () => {
    const block = buildAssistantIdentityBlock("Claude Sonnet 4", "agent");

    expect(block).toContain("Claude Sonnet 4");
    expect(block).toContain("Agent mode");
    expect(block).toContain(IDE_NAME);
    expect(block).toContain(
      `I'm Claude Sonnet 4 in Agent mode, powering the agent inside ${IDE_NAME}`,
    );
    expect(block).toContain("reading and editing files");
    expect(block).toContain("Do not claim to be a separate website");
  });

  it("uses generic wording when model title is missing", () => {
    const block = buildAssistantIdentityBlock(undefined, "chat");

    expect(block).toContain("the configured model");
    expect(block).toContain("Chat mode");
    expect(block).toContain(
      `I'm the configured model in Chat mode, powering the agent inside ${IDE_NAME}`,
    );
  });

  it("does not alter mode-specific default messages", () => {
    expect(DEFAULT_AGENT_SYSTEM_MESSAGE).toContain("You are in agent mode");
  });
});
