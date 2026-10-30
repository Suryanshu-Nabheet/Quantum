import type {
  DocumentSymbol,
  FileStatsMap,
  FileType,
  IDE,
  AgentPlanViewData,
  IdeInfo,
  IdeSettings,
  Location,
  Problem,
  Range,
  RangeInFile,
  SignatureHelp,
  TerminalOptions,
  Thread,
} from "../";


export type ToIdeFromWebviewOrCoreProtocol = {
  // Methods from IDE type
  getIdeInfo: [undefined, IdeInfo];
  getWorkspaceDirs: [undefined, string[]];
  writeFile: [{ path: string; contents: string }, void];
  removeFile: [{ path: string }, void];
  showVirtualFile: [{ name: string; content: string; preview?: boolean }, void];
  openAgentPlan: [AgentPlanViewData, void];
  updateAgentPlan: [AgentPlanViewData, void];
  openFile: [{ path: string }, void];
  openUrl: [string, void];
  runCommand: [{ command: string; options?: TerminalOptions }, void];
  getSearchResults: [
    { query: string; maxResults?: number; isRegExp?: boolean },
    string,
  ];
  getFileResults: [
    { pattern: string; maxResults?: number; includeMedia?: boolean },
    string[],
  ];
  readFileAsDataUrl: [
    { filepath: string; maxBytes?: number },
    string | undefined,
  ];
  saveFile: [{ filepath: string }, void];
  fileExists: [{ filepath: string }, boolean];
  readFile: [{ filepath: string }, string];
  getProblems: [{ filepath: string }, Problem[]];
  getOpenFiles: [undefined, string[]];
  getCurrentFile: [
    undefined,
    (
      | undefined
      | {
          isUntitled: boolean;
          path: string;
          contents: string;
        }
    ),
  ];
  getPinnedFiles: [undefined, string[]];
  showLines: [{ filepath: string; startLine: number; endLine: number }, void];
  readRangeInFile: [{ filepath: string; range: Range }, string];
  getDiff: [{ includeUnstaged: boolean }, string[]];
  getClipboardContent: [
    undefined,
    {
      text: string;
      copiedAt: string;
    },
  ];
  getTerminalContents: [undefined, string];
  getDebugLocals: [{ threadIndex: number }, string];
  getTopLevelCallStackSources: [
    { threadIndex: number; stackDepth: number },
    string[],
  ];
  getAvailableThreads: [undefined, Thread[]];

  isWorkspaceRemote: [undefined, boolean];
  isTelemetryEnabled: [undefined, boolean];
  getUniqueId: [undefined, string];
  readSecrets: [{ keys: string[] }, Record<string, string>];
  writeSecrets: [{ secrets: Record<string, string> }, void];
  // end methods from IDE type

  getIdeSettings: [undefined, IdeSettings];

  // Git
  getBranch: [{ dir: string }, string];
  getRepoName: [{ dir: string }, string | undefined];

  showToast: [
    Parameters<IDE["showToast"]>,
    Awaited<ReturnType<IDE["showToast"]>>,
  ];
  getGitRootPath: [{ dir: string }, string | undefined];
  getGitRefs: [{ dir: string }, Array<{ id: string; name: string; revision?: string }>];
  getGitHistory: [{ dir: string; ref: string; limit: number }, Array<{ id: string; displayId?: string; subject: string; message: string; author?: string; timestamp?: number }>];
  getGitCommitContext: [{ dir: string; commitId: string }, string | undefined];
  listDir: [{ dir: string }, [string, FileType][]];
  getFileStats: [{ files: string[] }, FileStatsMap];

  gotoDefinition: [{ location: Location }, RangeInFile[]];
  gotoTypeDefinition: [{ location: Location }, RangeInFile[]];
  getSignatureHelp: [{ location: Location }, SignatureHelp | null];
  getReferences: [{ location: Location }, RangeInFile[]];
  getDocumentSymbols: [{ textDocumentIdentifier: string }, DocumentSymbol[]];

  getBrowserPages: [undefined, import("../index.js").AgentBrowserPageSummary[]];
  getBrowserPageContext: [{ browserId: string }, string | undefined];
  ensureBrowserPageShared: [{ browserId: string }, boolean];
  invokeBrowserTool: [
    { toolId: string; parameters: Record<string, unknown> },
    string,
  ];
  notifyAgentBrowserSubmit: [undefined, void];


  reportError: [any, void];
  closeSidebar: [undefined, void];
};

export type ToWebviewOrCoreFromIdeProtocol = {
  didChangeActiveTextEditor: [{ filepath: string }, void];
};
