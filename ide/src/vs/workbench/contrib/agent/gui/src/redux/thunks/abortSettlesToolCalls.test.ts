import { describe, expect, it, vi } from "vitest";
import { ModelDescription } from "core";
import { getEmptyRootState, createMockStore } from "../../util/test/mockStore";
import { RootState } from "../store";
import { selectCurrentToolCalls } from "../selectors/selectToolCalls";
import { runAgentDriver } from "./streamNormalInput";

const claude: ModelDescription = {
  title: "Claude 3.5 Sonnet",
  model: "claude-3-5-sonnet-20241022",
  provider: "anthropic",
  underlyingProviderName: "anthropic",
  completionOptions: {},
};

function stateWithGeneratingToolCall(): RootState {
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
      id: "session-abort-tools",
      history: [
        { message: { id: "u1", role: "user", content: "edit files" }, contextItems: [] },
        {
          message: { id: "a1", role: "assistant", content: "" },
          contextItems: [],
          toolCallStates: [
            {
              toolCallId: "tc-1",
              toolCall: {
                id: "tc-1",
                type: "function",
                function: { name: "edit_file", arguments: "{}" },
              },
              status: "generating",
              parsedArgs: {},
            },
          ] as any,
        },
      ] as any,
    },
  };
}

describe("aborted stream settles in-flight tool calls", () => {
  it("moves a call still in generating to errored so the next turn is not wedged", async () => {
    const mockStore = createMockStore(stateWithGeneratingToolCall());
    const messenger = mockStore.mockIdeMessenger;
    messenger.responses["llm/compileChat"] = {
      compiledChatMessages: [{ role: "user", content: "edit files" }],
      didPrune: false,
      contextPercentage: 0.5,
    };
    // The stream hangs until the abort arrives, so the abort branch is the one
    // that ends the turn, which is the real interruption scenario.
    let streamStarted!: () => void;
    const started = new Promise<void>((resolve) => (streamStarted = resolve));
    messenger.llmStreamChat = vi.fn().mockImplementation(async function* (
      _args: unknown,
      signal: AbortSignal,
    ) {
      streamStarted();
      await new Promise<void>((resolve) =>
        signal.addEventListener("abort", () => resolve()),
      );
    });

    const driver = mockStore.dispatch(
      (async (dispatch: any, getState: any, extra: any) =>
        runAgentDriver({ depth: 0, dispatch, extra, getState } as any)) as any,
    );
    // Abort only after the stream is live, so the controller the driver captured is the one aborted.
    await started;
    mockStore.dispatch({ type: "session/abortStream" });
    await driver;

    const state = mockStore.getState() as RootState;
    const calls = selectCurrentToolCalls(state);
    expect(calls.some((tc) => tc.status === "generating")).toBe(false);
    expect(calls.find((tc) => tc.toolCallId === "tc-1")?.status).toBe("errored");
  });
});
