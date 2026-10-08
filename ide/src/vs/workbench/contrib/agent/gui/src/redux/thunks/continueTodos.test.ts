import { describe, expect, it, vi } from "vitest";
import { ModelDescription } from "core";
import { getEmptyRootState, createMockStore } from "../../util/test/mockStore";
import { RootState } from "../store";
import { continueTodos } from "./continueTodos";

const claude: ModelDescription = {
  title: "Claude 3.5 Sonnet",
  model: "claude-3-5-sonnet-20241022",
  provider: "anthropic",
  underlyingProviderName: "anthropic",
  completionOptions: {},
};

function stateWithOpenTodo(): RootState {
  const state = getEmptyRootState();
  return {
    ...state,
    config: {
      ...state.config,
      config: {
        ...state.config.config,
        selectedModelByRole: { ...state.config.config.selectedModelByRole, chat: claude },
      },
    },
    session: {
      ...state.session,
      id: "session-todos",
      history: [{ message: { id: "1", role: "user", content: "do it" }, contextItems: [] }],
      todos: [{ id: "t1", content: "step", status: "in_progress" }] as any,
    },
  };
}

describe("continueTodos error policy", () => {
  it("cancels the stream and surfaces an error when a continuation turn fails", async () => {
    const mockStore = createMockStore(stateWithOpenTodo());
    const messenger = mockStore.mockIdeMessenger;
    messenger.responses["llm/compileChat"] = {
      compiledChatMessages: [{ role: "user", content: "do it" }],
      didPrune: false,
      contextPercentage: 0.5,
    };
    // A non-retryable failure in the very first continuation turn.
    messenger.llmStreamChat = vi.fn().mockImplementation(() => {
      throw new Error("invalid api key");
    });

    await mockStore.dispatch(continueTodos() as any);

    const state = mockStore.getState() as RootState;
    expect(state.session.isStreaming).toBe(false);
    expect(state.ui.showDialog).toBe(true);
  });
});
