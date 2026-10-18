import { AssistantChatMessage, ModelDescription, PromptLog } from "core";
import { serializeTool } from "core/tools";
import { grepSearchTool } from "core/tools/definitions";
import { describe, expect, it, vi } from "vitest";
import { MockHostBridge } from "../../context/MockHostBridge";
import { createMockStore } from "../../util/test/mockStore";
import { getEmptyRootState } from "../../util/test/mockStore";
import { RootState } from "../store";
import { acceptAllPendingToolCalls } from "./acceptAllPendingToolCalls";
import { streamResponseThunk } from "./streamResponse";

vi.mock("../util/getBaseSystemMessage", () => ({
  getBaseSystemMessage: vi.fn(() => "Base system message"),
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "mock-uuid-batch"),
}));

const grepTool = serializeTool(grepSearchTool);
const grepName = grepTool.function.name;

const claudeModel: ModelDescription = {
  title: "Claude 3.5 Sonnet",
  model: "claude-3-5-sonnet-20241022",
  provider: "anthropic",
  underlyingProviderName: "anthropic",
  completionOptions: { reasoningBudgetTokens: 2048 },
};

function rootStateWithClaude(): RootState {
  const state = getEmptyRootState();
  return {
    ...state,
    config: {
      ...state.config,
      config: {
        ...state.config.config,
        selectedModelByRole: {
          ...state.config.config.selectedModelByRole,
          chat: claudeModel,
        },
      },
    },
  };
}

describe("acceptAllPendingToolCalls (batch resume)", () => {
  it("runs every pending tool once and resumes the agent a single time", async () => {
    const initialState = rootStateWithClaude();
    initialState.session.history = [
      {
        message: { id: "1", role: "user", content: "Run two searches" },
        contextItems: [],
      },
    ];
    initialState.session.id = "session-batch";
    initialState.ui.toolSettings = {
      [grepName]: "allowedWithPermission",
    };
    initialState.config.config.tools = [grepTool];

    const hostBridge = new MockHostBridge();
    hostBridge.responses["llm/assembleChat"] = {
      compiledChatMessages: [
        { role: "user", content: "Run two searches" },
      ],
      didPrune: false,
      contextPercentage: 0.5,
    };

    let streamCalls = 0;
    hostBridge.llmStreamChat = vi.fn().mockImplementation(() => {
      streamCalls++;
      if (streamCalls === 1) {
        return (async function* (): AsyncGenerator<
          AssistantChatMessage[],
          PromptLog
        > {
          yield [{ role: "assistant", content: "Searching in two places." }];
          yield [
            {
              role: "assistant",
              content: "",
              toolCalls: [
                {
                  id: "batch-a",
                  type: "function",
                  function: {
                    name: grepName,
                    arguments: JSON.stringify({ query: "alpha" }),
                  },
                },
                {
                  id: "batch-b",
                  type: "function",
                  function: {
                    name: grepName,
                    arguments: JSON.stringify({ query: "beta" }),
                  },
                },
              ],
            },
          ];
          return {
            prompt: "run two searches",
            completion: "Searching in two places.",
            modelProvider: "anthropic",
            modelTitle: "Claude 3.5 Sonnet",
          };
        })();
      }
      return (async function* (): AsyncGenerator<
        AssistantChatMessage[],
        PromptLog
      > {
        yield [{ role: "assistant", content: "Both searches are done." }];
        return {
          prompt: "continuing after batch",
          completion: "Both searches are done.",
          modelProvider: "anthropic",
          modelTitle: "Claude 3.5 Sonnet",
        };
      })();
    });

    const toolCallIds: string[] = [];
    hostBridge.responseHandlers["tools/call"] = async (data: any) => {
      toolCallIds.push(data.toolCall.id);
      return {
        contextItems: [
          {
            name: "Result",
            description: "match",
            content: `hit for ${data.toolCall.function.arguments}`,
            icon: "search",
            hidden: false,
          },
        ],
      };
    };

    const store = createMockStore(initialState, hostBridge);

    // Turn 1: produces two tool calls awaiting approval (no auto-execution).
    await store.dispatch(
      streamResponseThunk({
        editorState: { type: "doc", content: [] } as any,
        modifiers: {} as any,
      }) as any,
    );
    const streamCallsAfterFirstTurn = streamCalls;
    expect(streamCallsAfterFirstTurn).toBe(1);

    const pendingBefore = (store.getState() as RootState).session.history
      .flatMap((h) => h.toolCallStates ?? [])
      .filter((tc) => tc.status === "generated");
    expect(pendingBefore).toHaveLength(2);

    // User accepts the whole batch: both tools run, the agent resumes once.
    await store.dispatch(acceptAllPendingToolCalls() as any);

    expect(toolCallIds.sort()).toEqual(["batch-a", "batch-b"]);

    const finalStatuses = (store.getState() as RootState).session.history
      .flatMap((h) => h.toolCallStates ?? [])
      .map((tc) => tc.status);
    expect(finalStatuses).toEqual(["done", "done"]);

    expect(streamCalls).toBeGreaterThan(streamCallsAfterFirstTurn);
  });
});
