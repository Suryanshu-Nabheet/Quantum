import { SlashCommandDescWithSource } from "core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockHostBridge } from "../../../../context/MockHostBridge";
import { getPromptV2ContextRequests } from "./renderPromptv2";

function getTestPromptV2Command(body: string): SlashCommandDescWithSource {
  return {
    prompt: body,
    name: "test-prompt-name",
    description: "test-prompt-description",
    isLegacy: false,
    source: "quantum-settings-prompt",
  };
}
describe("getPromptV2ContextRequests", () => {
  const hostBridge = new MockHostBridge();
  const firstDir = hostBridge.responses["getWorkspaceDirs"]?.[0] ?? "";
  beforeEach(async () => {
    vi.clearAllMocks();
    hostBridge.resetMocks();
  });

  it("should render a prompt file with no attachments", async () => {
    const rawContent = "Simple prompt with no attachments";
    const command = getTestPromptV2Command(rawContent);
    const requests = await getPromptV2ContextRequests(hostBridge, command);
    expect(requests).toHaveLength(0);
  });

  it("should resolve file attachments", async () => {
    const rawContent = "Content with file attachment @test.txt";
    const command = getTestPromptV2Command(rawContent);
    const requests = await getPromptV2ContextRequests(hostBridge, command);

    expect(requests).toHaveLength(1);
    expect(requests[0].provider).toBe("file");
    expect(requests[0].query).toBe(`${firstDir}/test.txt`);
  });

  it("should ignore unsupported providers", async () => {
    hostBridge.responses["fileExists"] = false;
    const rawContent = "Content with custom provider @unsupported";
    const command = getTestPromptV2Command(rawContent);
    const requests = await getPromptV2ContextRequests(hostBridge, command);
    expect(requests).toHaveLength(0);
  });

  it("should handle multiple attachments", async () => {
    const rawContent = "Content with @file1.txt and @file2.txt";
    const command = getTestPromptV2Command(rawContent);
    const requests = await getPromptV2ContextRequests(hostBridge, command);

    expect(requests).toHaveLength(2);
    expect(requests[0].provider).toBe("file");
    expect(requests[0].query).toBe(`${firstDir}/file1.txt`);
    expect(requests[1].provider).toBe("file");
    expect(requests[1].query).toBe(`${firstDir}/file2.txt`);
  });
});
