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
  return `${buildAssistantIdentityBlock(modelTitle, mode)}\n\n${base}`;
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
  const message = getBaseSystemMessage(
    "chat",
    { title: "Qwen2.5 Coder" } as ModelDescription,
    [],
  );

  expect(message).toContain("Qwen2.5 Coder");
  expect(message).toContain("Chat mode");
  expect(message).toContain("powering the agent inside Quantum");
  expect(message).toContain("I'm Qwen2.5 Coder in Chat mode");
});
