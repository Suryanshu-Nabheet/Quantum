import { JSONContent } from "@tiptap/core";
import { InputModifiers } from "core";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createMockStore, getEmptyRootState } from "../../util/test/mockStore";
import { streamResponseThunk } from "./streamResponse";

// Mock system message construction to keep test readable
vi.mock("../util/getBaseSystemMessage", () => ({
  getBaseSystemMessage: vi.fn(),
}));

import { getBaseSystemMessage } from "../util/getBaseSystemMessage";

vi.mock("uuid", () => ({
  v4: vi.fn(() => "mock-uuid-123"),
}));

vi.mock(
  "../../components/mainInput/TipTapEditor/utils/resolveEditorContent",
  () => ({
    resolveEditorContent: vi.fn(),
  }),
);

import { unwrapResult } from "@reduxjs/toolkit";
import { resolveEditorContent } from "../../components/mainInput/TipTapEditor/utils/resolveEditorContent";
import { MockHostBridge } from "../../context/MockHostBridge";
import { RootState } from "../store";
import { getRootStateWithClaude } from "./streamResponse.test";
import { expectStreamResponseLifecycle } from "../../util/test/dispatchAssertions";

const mockGetBaseSystemMessage = vi.mocked(getBaseSystemMessage);
const mockResolveEditorContent = vi.mocked(resolveEditorContent);

// Mock editor state (what user types in the input)
const mockEditorState: JSONContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Hello, please help me with this code" }],
    },
  ],
};

// Mock input modifiers
const mockModifiers: InputModifiers = {
  noContext: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveEditorContent.mockResolvedValue({
    selectedContextItems: [],
    selectedCode: [],
    content: "Hello, please help me with this code",
    legacyCommandWithInput: undefined,
  });

  // Mock getBaseSystemMessage to return simple system message for readable tests
  mockGetBaseSystemMessage.mockReturnValue("You are a helpful assistant.");
});

describe("streamResponseThunk", () => {
  it("should throw error when no chat model is selected", async () => {
    const noModelState = getEmptyRootState();
    noModelState.session.history = [
      {
        message: { id: "1", role: "user", content: "Hello" },
        contextItems: [],
      },
    ];

    // Create store with no selected chat model
    const mockStoreNoModel = createMockStore(noModelState);
    const requestSpy = vi.spyOn(mockStoreNoModel.mockHostBridge, "request");
    const chatSpy = vi.spyOn(
      mockStoreNoModel.mockHostBridge,
      "llmStreamChat",
    );

    // Execute thunk and expect it to be rejected
    const result = await mockStoreNoModel.dispatch(
      streamResponseThunk({
        editorState: mockEditorState,
        modifiers: mockModifiers,
      }) as any,
    );

    // Verify the thunk completed successfully but shows error dialog
    expect(result.type).toBe("chat/streamResponse/fulfilled");

    const dispatchedActions = mockStoreNoModel.getActions();
    expect(dispatchedActions[0]?.type).toBe("chat/streamResponse/pending");
    expect(dispatchedActions.at(-1)?.type).toBe("chat/streamResponse/fulfilled");

    expect(requestSpy).not.toHaveBeenCalledWith(
      "llm/assembleChat",
      expect.anything(),
    );
    expect(chatSpy).not.toHaveBeenCalled();

    const finalState = mockStoreNoModel.getState() as RootState;
    expect(finalState.ui.showDialog).toBe(true);
    expect(finalState.ui.dialogMessage).toMatchObject({
      props: expect.objectContaining({
        error: expect.objectContaining({
          message: "No chat model selected",
        }),
      }),
    });
  });

  it("should handle compilation error - not enough context", async () => {
    const initialState = getRootStateWithClaude();
    initialState.session.history = [
      {
        message: { id: "1", role: "user", content: "Hello" },
        contextItems: [],
      },
    ];
    initialState.session.id = "session-123";
    const mockStore = createMockStore(initialState);
    const mockHostBridge = mockStore.mockHostBridge;
    const requestSpy = vi.spyOn(mockHostBridge, "request");
    const chatSpy = vi.spyOn(mockHostBridge, "llmStreamChat");

    requestSpy.mockImplementation(async (message, data) => {
      if (message === "llm/assembleChat") {
        return {
          done: true,
          status: "error",
          error: "Not enough context available for this request",
        };
      } else {
        return await new MockHostBridge().request(message, data);
      }
    });

    // Execute thunk
    const result = await mockStore.dispatch(
      streamResponseThunk({
        editorState: mockEditorState,
        modifiers: mockModifiers,
      }) as any,
    );
    unwrapResult(result);

    // Verify thunk completed successfully (doesn't throw, handles error gracefully)
    expect(result.type).toBe("chat/streamResponse/fulfilled");

    // Verify exact action sequence for this error path
    const dispatchedActions = mockStore.getActions();
    // Verify IDE messenger was called for compilation but not streaming
    expect(requestSpy).toHaveBeenCalledWith("llm/assembleChat", {
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant.",
        },
        {
          role: "user",
          content: [
            {
              text: "Hello",
              type: "text",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              text: "Hello, please help me with this code",
              type: "text",
            },
          ],
        },
      ],
      options: {},
    });
    expect(chatSpy).not.toHaveBeenCalled();

    // Verify final state shows error condition
    const finalState = mockStore.getState();
    expect(finalState).toEqual({
      ...initialState,
      session: {
        ...initialState.session,
        isSessionMetadataLoading: false,
        title: "Hello",
        history: [
          {
            contextItems: [],
            message: {
              content: "Hello",
              id: "1",
              role: "user",
            },
          },
          {
            appliedRules: [],
            contextItems: [],
            editorState: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: "Hello, please help me with this code",
                    },
                  ],
                },
              ],
            },
            message: {
              content: "Hello, please help me with this code",
              id: "mock-uuid-123",
              role: "user",
            },
          },
          {
            contextItems: [],
            isGatheringContext: false,
            message: {
              content: "",
              id: "mock-uuid-123",
              role: "assistant",
            },
          },
        ],
        streamAborter: expect.any(AbortController),
        inlineErrorMessage: "out-of-context", // Error message set
      },
    });
  });

  it("should throw error for other compilation errors", async () => {
    const initialState = getRootStateWithClaude();
    initialState.session.history = [
      {
        message: { id: "1", role: "user", content: "Hello" },
        contextItems: [],
      },
    ];
    const mockStore = createMockStore(initialState);
    const mockHostBridge = mockStore.mockHostBridge;
    const originalRequest = mockHostBridge.request.bind(mockHostBridge);
    const requestSpy = vi.spyOn(mockHostBridge, "request");
    const chatSpy = vi.spyOn(mockHostBridge, "llmStreamChat");

    // Mock compilation failure with generic error
    requestSpy.mockImplementation(async (message, data) => {
      if (message === "llm/assembleChat") {
        return {
          done: true,
          status: "error",
          error: "Model configuration is invalid",
        };
      } else {
        return await originalRequest(message, data);
      }
    });

    // Execute thunk and expect it to be rejected
    const result = await mockStore.dispatch(
      streamResponseThunk({
        editorState: mockEditorState,
        modifiers: mockModifiers,
      }) as any,
    );

    // Verify thunk completed successfully but shows error dialog
    expect(result.type).toBe("chat/streamResponse/fulfilled");

    // Verify exact action sequence for compilation error with dialog
    const dispatchedActions = mockStore.getActions();
    // Verify IDE messenger was called for compilation but not streaming
    expect(requestSpy).toHaveBeenCalledWith("llm/assembleChat", {
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Hello",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Hello, please help me with this code",
            },
          ],
        },
      ],
      options: {},
    });
    expect(chatSpy).not.toHaveBeenCalled();

    const finalState = mockStore.getState() as RootState;
    expect(finalState.ui.showDialog).toBe(true);
    expect(finalState.ui.dialogMessage).toMatchObject({
      props: expect.objectContaining({
        error: expect.objectContaining({
          message: "Model configuration is invalid",
        }),
      }),
    });
  });
});
