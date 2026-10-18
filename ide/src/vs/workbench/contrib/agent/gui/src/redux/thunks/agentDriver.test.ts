import { AssistantChatMessage, ModelDescription, PromptLog } from "core";
import { serializeTool } from "core/tools";
import { grepSearchTool } from "core/tools/definitions";
import { describe, expect, it, vi } from "vitest";
import { getEmptyRootState } from "../../util/test/mockStore";
import { createMockStore } from "../../util/test/mockStore";
import { RootState } from "../store";
import { runAgentDriver } from "./streamModelTurn";
// Imported as a namespace so the spy observes real call sites in the driver.
import * as resumeModule from "./streamResponseAfterToolCall";

vi.mock("../util/getBaseSystemMessage", () => ({
  getBaseSystemMessage: vi.fn(() => "You are a helpful assistant."),
}));

const grepName = serializeTool(grepSearchTool).function.name;

const claude: ModelDescription = {
  title: "Claude 3.5 Sonnet",
  model: "claude-3-5-sonnet-20241022",
  provider: "anthropic",
  underlyingProviderName: "anthropic",
  completionOptions: {},
};

function stateWithClaude(): RootState {
  const state = getEmptyRootState();
  return {
    ...state,
    config: {
      ...state.config,
      config: {
        ...state.config.config,
        selectedModelByRole: {
          ...state.config.config.selectedModelByRole,
          chat: claude,
        },
      },
    },
  };
}

function turn(
  chunks: AssistantChatMessage[][],
  completion: string,
): AsyncGenerator<AssistantChatMessage[], PromptLog> {
  return (async function* () {
    for (const chunk of chunks) {
      yield chunk;
    }
    return {
      prompt: "p",
      completion,
      modelProvider: "anthropic",
      modelTitle: "Claude 3.5 Sonnet",
    };
  })();
}

describe("runAgentDriver", () => {
  it("runs a tool turn and the follow-up turn inside one call, without the resume thunk", async () => {
    const initialState = stateWithClaude();
    initialState.session.history = [
      {
        message: { id: "1", role: "user", content: "search" },
        contextItems: [],
      },
    ];
    initialState.session.id = "session-driver";
    initialState.config.config.tools = [serializeTool(grepSearchTool)];
    initialState.ui.toolSettings = {
      [grepName]: "allowedWithoutPermission",
    };
    const mockStore = createMockStore(initialState);
    const mockHostBridge = mockStore.mockHostBridge;

    mockHostBridge.responses["llm/assembleChat"] = {
      compiledChatMessages: [{ role: "user", content: "search" }],
      didPrune: false,
      contextPercentage: 0.5,
    };
    mockHostBridge.responses["tools/call"] = {
      contextItems: [
        { name: "grep", description: "match", content: "found" },
      ],
    };

    // Turn 1 emits a tool call; turn 2 (after the tool result) is plain text.
    const toolCallChunk: AssistantChatMessage[] = [
      {
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "tool-1",
            type: "function",
            function: { name: grepName, arguments: "{}" },
          },
        ],
      },
    ];
    const streamChat = vi.fn().mockImplementation(() => {
      const n = streamChat.mock.calls.length;
      if (n === 1) {
        return turn([toolCallChunk], "");
      }
      return turn([[{ role: "assistant", content: "all done" }]], "all done");
    });
    mockHostBridge.llmStreamChat = streamChat as any;

    const resumeSpy = vi.spyOn(resumeModule, "streamResponseAfterToolCall");

    await runAgentDriver({
      depth: 0,
      dispatch: mockStore.dispatch as any,
      extra: { hostBridge: mockHostBridge } as any,
      getState: mockStore.getState as any,
    });

    // Two LLM turns happened inside one driver invocation.
    expect(streamChat.mock.calls.length).toBeGreaterThanOrEqual(2);
    // The per-turn resume thunk is never dispatched: continuation is a loop.
    expect(resumeSpy).not.toHaveBeenCalled();
  });
});
