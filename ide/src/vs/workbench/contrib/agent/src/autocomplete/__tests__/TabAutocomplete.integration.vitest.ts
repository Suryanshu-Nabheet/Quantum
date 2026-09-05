import { beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";

import { AgentCompletionProvider } from "../completionProvider";

const mockProvideInlineCompletionItems = vi.fn();

function hashString(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

vi.mock("core/autocomplete/CompletionProvider", () => ({
  CompletionProvider: class {
    provideLightweightInlineCompletionItems = mockProvideInlineCompletionItems;
    markDisplayed = vi.fn();
  },
}));

vi.mock("../statusBar", () => {
  const StatusBarStatus = { Enabled: "enabled", Disabled: "disabled" } as const;
  return {
    StatusBarStatus,
    getStatusBarStatus: vi.fn(() => StatusBarStatus.Enabled),
    setupStatusBar: vi.fn(),
    stopStatusBarLoading: vi.fn(),
  };
});

vi.mock("../../util/errorHandling", () => ({
  handleLLMError: vi.fn(async () => false),
}));

vi.mock("vscode", () => {
  class Position {
    constructor(
      public line: number,
      public character: number,
    ) {}
  }

  class Range {
    constructor(
      public start: Position,
      public end: Position,
    ) {}
  }

  class InlineCompletionItem {
    constructor(
      public insertText: string,
      public range: Range,
    ) {}
  }

  return {
    window: { activeTextEditor: null as any, showErrorMessage: vi.fn() },
    workspace: {
      notebookDocuments: [],
      getConfiguration: vi.fn(() => ({ get: vi.fn() })),
      onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
    },
    commands: { executeCommand: vi.fn() },
    Uri: { parse: (value: string) => ({ toString: () => value, scheme: "file" }) },
    Position,
    Range,
    InlineCompletionItem,
    InlineCompletionTriggerKind: { Automatic: 0, Invoke: 1 },
    NotebookCellKind: { Markup: 1 },
  };
});

describe("Tab autocomplete integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProvideInlineCompletionItems.mockReset();
    (vscode.window as any).activeTextEditor = null;
  });

  it("returns prefetched completion on the fast path", async () => {
    const provider = buildTabProvider();
    const document = createDocument("function example() {\n  return true;\n}");
    const position = new (vscode.Position as any)(1, 2);
    setActiveEditor(document, position);

    const outcome = {
      completion: "turn 42;",
      completionId: "completion-1",
      completionRange: {
        start: { line: 1, character: 2 },
        end: { line: 1, character: 2 },
      },
    };

    const fetchKey = (provider as any).autocompleteSession.positionKey(
      document.uri.toString(),
      document.version,
      position,
      "  ",
      hashString("return true;\n}"),
      "none",
    );
    (provider as any).autocompleteSession.setPrefetch(
      fetchKey,
      outcome,
      document.version,
    );

    const result = await provider.provideInlineCompletionItems(
      document,
      position,
      { triggerKind: 0, selectedCompletionInfo: undefined },
      createToken(),
    );

    expect(result).toHaveLength(1);
    expect((result as any)[0].insertText).toContain("turn 42;");
    expect(mockProvideInlineCompletionItems).not.toHaveBeenCalled();
  });

  it("fast-forwards ghost text while the user types matching characters", async () => {
    const provider = buildTabProvider();
    const document = createDocument("return ;\n");
    const startPosition = new (vscode.Position as any)(0, 7);
    setActiveEditor(document, startPosition);

    (provider as any).autocompleteSession.setCurrentCompletion(
      "42;",
      "completion-ff",
    );
    (provider as any).autocompleteSession.notePosition(startPosition);

    const typedDocument = createDocument("return 4;\n");
    const nextPosition = new (vscode.Position as any)(0, 8);
    setActiveEditor(typedDocument, nextPosition);

    const result = await provider.provideInlineCompletionItems(
      typedDocument,
      nextPosition,
      { triggerKind: 0, selectedCompletionInfo: undefined },
      createToken(),
    );

    expect(result).toHaveLength(1);
    expect((result as any)[0].insertText).toBe("2;");
  });

  it("returns quick background fetch results immediately", async () => {
    mockProvideInlineCompletionItems.mockResolvedValue({
      completion: "42;",
      completionId: "quick-1",
      completionRange: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
    });

    const provider = buildTabProvider();
    const document = createDocument("const answer = ");
    const position = new (vscode.Position as any)(0, 15);
    setActiveEditor(document, position);

    const result = await provider.provideInlineCompletionItems(
      document,
      position,
      { triggerKind: 0, selectedCompletionInfo: undefined },
      createToken(),
    );

    expect(result).toHaveLength(1);
    expect((result as any)[0].insertText).toBe("42;");
    expect(mockProvideInlineCompletionItems).toHaveBeenCalledTimes(1);
  });

  it("strips prose and markdown from rendered completions", async () => {
    mockProvideInlineCompletionItems.mockResolvedValue({
      completion: "Here is the completion:\n```ts\n42;\n```",
      completionId: "clean-1",
      completionRange: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
    });

    const provider = buildTabProvider();
    const document = createDocument("const answer = ");
    const position = new (vscode.Position as any)(0, 15);
    setActiveEditor(document, position);

    const result = await provider.provideInlineCompletionItems(
      document,
      position,
      { triggerKind: 0, selectedCompletionInfo: undefined },
      createToken(),
    );

    expect(result).toHaveLength(1);
    expect((result as any)[0].insertText).toBe("42;");
  });

  it("starts a slow background fetch and returns null on first request", async () => {
    mockProvideInlineCompletionItems.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                completion: "slow result",
                completionId: "slow-1",
                completionRange: {
                  start: { line: 0, character: 0 },
                  end: { line: 0, character: 0 },
                },
              }),
            1000,
          );
        }),
    );

    const provider = buildTabProvider();
    const document = createDocument("const slow = ");
    const position = new (vscode.Position as any)(0, 12);
    setActiveEditor(document, position);

    const first = await provider.provideInlineCompletionItems(
      document,
      position,
      { triggerKind: 0, selectedCompletionInfo: undefined },
      createToken(),
    );

    expect(first).toBeNull();
    expect(mockProvideInlineCompletionItems).toHaveBeenCalledTimes(1);
  });
});

function buildTabProvider() {
  const configHandler = {
    loadConfig: vi.fn(async () => ({
      config: { selectedModelByRole: { autocomplete: undefined } },
    })),
    onConfigUpdate: vi.fn(),
    currentProfile: undefined,
  } as any;

  return new AgentCompletionProvider(configHandler);
}

function createDocument(text: string): vscode.TextDocument {
  const lines = text.split("\n");
  return {
    uri: vscode.Uri.parse("file:///tab-autocomplete-test.ts"),
    version: 1,
    lineCount: lines.length,
    isUntitled: false,
    getText: (range?: any) => {
      if (!range) {
        return text;
      }
      const startLine = range.start?.line ?? 0;
      const endLine = range.end?.line ?? startLine;
      const startChar = range.start?.character ?? 0;
      const endChar = range.end?.character ?? lines[endLine]?.length ?? 0;
      if (startLine === endLine) {
        return (lines[startLine] ?? "").slice(startChar, endChar);
      }
      return text;
    },
    lineAt: (position: any) => {
      const lineNumber =
        typeof position === "number" ? position : position.line;
      const lineText = lines[lineNumber] ?? "";
      const range = new (vscode.Range as any)(
        new (vscode.Position as any)(lineNumber, 0),
        new (vscode.Position as any)(lineNumber, lineText.length),
      );
      return { lineNumber, text: lineText, range };
    },
  } as unknown as vscode.TextDocument;
}

function setActiveEditor(document: vscode.TextDocument, position: any) {
  const selection = { active: position, anchor: position, isEmpty: true };
  (vscode.window as any).activeTextEditor = {
    document,
    selection,
    selections: [selection],
  };
}

function createToken(): vscode.CancellationToken {
  return {
    isCancellationRequested: false,
    onCancellationRequested: vi.fn(),
  } as any;
}
