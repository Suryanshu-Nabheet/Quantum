import { ToIdeFromWebviewOrCoreProtocol } from "./ide";
import { ToWebviewFromIdeOrCoreProtocol } from "./webview";

import {
  AcceptOrRejectDiffPayload,
  AttachBrowserContextPayload,
  AddToChatPayload,
  ApplyState,
  ApplyToFilePayload,
  ContextItemWithId,
  HighlightedCodePayload,
  MessageContent,
  RangeInFile,
  RangeInFileWithContents,
  SetCodeToEditPayload,
  ShowFilePayload,
} from "../";

export type ToIdeFromWebviewProtocol = ToIdeFromWebviewOrCoreProtocol & {
  agentGuiReady: [undefined, void];
  openUrl: [string, void];
  applyToFile: [ApplyToFilePayload, void];
  overwriteFile: [{ filepath: string; prevFileContent: string | null }, void];
  revertAgentEdit: [{ streamId: string; filepath: string; expectedContent: string; originalContent?: string; createdFile?: boolean }, void];
  showFile: [ShowFilePayload, void];
  toggleDevTools: [undefined, void];
  reloadWindow: [undefined, void];
  focusEditor: [undefined, void];
  showWorkbenchHover: [
    {
      viewId?: string;
      content: string;
      rect: { x: number; y: number; width: number; height: number };
      placement?: "top" | "bottom" | "left" | "right";
    },
    void,
  ];
  hideWorkbenchHover: [undefined, void];
  openConfigPage: [string | undefined, void];
  openVscodeSettings: [undefined, void];
  "workbench/getAppearanceLayout": [
    undefined,
    {
      statusBarVisible: boolean;
      activityBarOrientation: "vertical" | "horizontal";
    },
  ];
  "workbench/setAppearanceLayout": [
    {
      statusBarVisible?: boolean;
      activityBarOrientation?: "vertical" | "horizontal";
    },
    void,
  ];
  openKeyboardShortcuts: [undefined, void];
  toggleFullScreen: [{ newWindow?: boolean } | undefined, void];
  insertAtCursor: [{ text: string }, void];
  copyText: [{ text: string }, void];
  openAgentDiagram: [{ source: string }, void];
  closeAgentDiagram: [undefined, void];
  agentDiagramReady: [undefined, void];
  acceptDiff: [AcceptOrRejectDiffPayload, void];
  rejectDiff: [AcceptOrRejectDiffPayload, void];
  "edit/sendPrompt": [
    {
      prompt: MessageContent;
      range: RangeInFileWithContents;
    },
    string | undefined,
  ];
  "edit/addCurrentSelection": [undefined, void];
  "edit/clearDecorations": [undefined, void];
  "vscode/openMoveRightMarkdown": [undefined, void];
};

export type ToWebviewFromIdeProtocol = ToWebviewFromIdeOrCoreProtocol & {
  setInactive: [undefined, void];
  newSessionWithPrompt: [{ prompt: string }, void];
  userInput: [{ input: string }, void];
  focusAgentInput: [undefined, void];
  focusAgentInputWithoutClear: [undefined, void];
  focusAgentInputWithNewSession: [undefined, void];
  highlightedCode: [HighlightedCodePayload, void];
  setCodeToEdit: [SetCodeToEditPayload, void];
  navigateTo: [{ path: string; toggle?: boolean }, void];
  addModel: [undefined, void];

  focusAgentSessionId: [{ sessionId: string | undefined }, void];
  newSession: [undefined, void];
  loadAgentSession: [{ session: any }, void];
  setTheme: [{ theme: any }, void];
  setColors: [{ [key: string]: string }, void];
  setupApiKey: [undefined, void];
  applyCodeFromChat: [undefined, void];
  updateApplyState: [ApplyState, void];
  exitEditMode: [undefined, void];
  focusEdit: [undefined, void];
  openModelPicker: [undefined, void];
  generateRule: [undefined, void];
  addToChat: [AddToChatPayload, void];
  attachBrowserContext: [AttachBrowserContextPayload, { attached: boolean }];
  isMainEditorReady: [undefined, { ready: boolean }];
};
