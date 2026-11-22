import { expect, test } from "vitest";
import { ModelDescription, Tool } from "core";
import {
  buildAssistantIdentityBlock,
  DEFAULT_AGENT_SYSTEM_MESSAGE,
  DEFAULT_CHAT_SYSTEM_MESSAGE,
  DEFAULT_PLAN_SYSTEM_MESSAGE,
} from "core/llm/defaultSystemMessages";
import { getBaseSystemMessage, NO_TOOL_WARNING } from "./getBaseSystemMessage";

function withIdentity(
  base: string,
  modelTitle?: string,
  mode: "chat" | "agent" | "plan" = "chat",
): string {
  return `${buildAssistantIdentityBlock(
    modelTitle ? { modelName: modelTitle } : {},
    mode,
  )}\n\n${base}`;
}

test("getBaseSystemMessage should return the correct system message based on mode", () => {
  const mockModel = {
    title: "Test Model",
    baseChatSystemMessage: "Custom Chat System Message",
    basePlanSystemMessage: "Custom Plan System Message",
    baseAgentSystemMessage: "Custom Agent System Message",
  } as ModelDescription;

  const mockTool = {
    function: {
      name: "testTool",
      description: "Test tool",
      parameters: {},
    },
  } as Tool;

  // Test agent mode with custom message and tools
  expect(getBaseSystemMessage("agent", mockModel, [mockTool])).toBe(
    withIdentity("Custom Agent System Message", "Test Model", "agent"),
  );

  // Test plan mode with custom message and tools
  expect(getBaseSystemMessage("plan", mockModel, [mockTool])).toBe(
    withIdentity("Custom Plan System Message", "Test Model", "plan"),
  );

  // Test chat mode with custom message and tools
  expect(getBaseSystemMessage("chat", mockModel, [mockTool])).toBe(
    withIdentity("Custom Chat System Message", "Test Model", "chat"),
  );

  // Test agent mode with default message and tools
  expect(
    getBaseSystemMessage("agent", {} as ModelDescription, [mockTool]),
  ).toBe(withIdentity(DEFAULT_AGENT_SYSTEM_MESSAGE, undefined, "agent"));

  // Test plan mode with default message and tools
  expect(getBaseSystemMessage("plan", {} as ModelDescription, [mockTool])).toBe(
    withIdentity(DEFAULT_PLAN_SYSTEM_MESSAGE, undefined, "plan"),
  );

  // Test chat mode with default message and tools
  expect(getBaseSystemMessage("chat", {} as ModelDescription, [mockTool])).toBe(
    withIdentity(DEFAULT_CHAT_SYSTEM_MESSAGE, undefined, "chat"),
  );
});

test("getBaseSystemMessage should append no-tools warning for agent/plan modes without tools", () => {
  const mockModel = {
    title: "Test Model",
    baseChatSystemMessage: "Custom Chat System Message",
    basePlanSystemMessage: "Custom Plan System Message",
    baseAgentSystemMessage: "Custom Agent System Message",
  } as ModelDescription;

  // Test agent mode without tools
  expect(getBaseSystemMessage("agent", mockModel, [])).toBe(
    withIdentity(
      "Custom Agent System Message" + NO_TOOL_WARNING,
      "Test Model",
      "agent",
    ),
  );

  // Test plan mode without tools
  expect(getBaseSystemMessage("plan", mockModel, [])).toBe(
    withIdentity(
      "Custom Plan System Message" + NO_TOOL_WARNING,
      "Test Model",
      "plan",
    ),
  );

  // Test chat mode without tools (should not append warning)
  expect(getBaseSystemMessage("chat", mockModel, [])).toBe(
    withIdentity("Custom Chat System Message", "Test Model", "chat"),
  );

  // Test agent mode with undefined tools
  expect(getBaseSystemMessage("agent", mockModel)).toBe(
    withIdentity(
      "Custom Agent System Message" + NO_TOOL_WARNING,
      "Test Model",
      "agent",
    ),
  );

  // Test plan mode with undefined tools
  expect(getBaseSystemMessage("plan", mockModel)).toBe(
    withIdentity(
      "Custom Plan System Message" + NO_TOOL_WARNING,
      "Test Model",
      "plan",
    ),
  );
});

test("getBaseSystemMessage prepends Quantum identity with the model title", () => {
  const model = {
    title: "Personal / @cf/zai-org/glm-5.3",
    model: "@cf/zai-org/glm-5.3",
    provider: "custom-openai-personal--abc123",
    underlyingProviderName: "custom-openai-personal--abc123",
  } as ModelDescription;
  const message = getBaseSystemMessage(
    "chat",
    model,
    [],
  );

  expect(message).toContain('"modelDisplayName":"GLM 5.3"');
  expect(message).not.toContain("Personal");
  expect(message).not.toContain("@cf/zai-org/glm-5.3");
  expect(message).toContain("Chat mode");
  expect(message).toContain("You are Quantum's AI assistant in Chat mode");
  expect(message).toContain("Do not volunteer the model name, provider");

  const providerQuestion = getBaseSystemMessage(
    "chat",
    model,
    [],
    "Which provider is configured?",
  );
  expect(providerQuestion).toContain('"providerDisplayName":"Personal"');
  expect(providerQuestion).toContain('"providerType":"custom"');
  expect(providerQuestion).not.toContain("modelIdentifier");

  const identifierQuestion = getBaseSystemMessage(
    "chat",
    model,
    [],
    "What is the model id?",
  );
  expect(identifierQuestion).toContain('"modelIdentifier":"@cf/zai-org/glm-5.3"');
  expect(identifierQuestion).not.toContain("providerDisplayName");
});
