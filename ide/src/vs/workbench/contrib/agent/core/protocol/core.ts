import { ConfigResult, MCPServer, ModelRole } from "agent-config";
import { ToolPolicy } from "terminal-security";

import { AutocompleteInput } from "../autocomplete/util/types";
import { SharedConfigSchema } from "../config/sharedConfig";
import { GlobalContextModelSelections } from "../util/GlobalContext";

import {
    BaseSessionMetadata,
    BrowserSerializedAgentConfig,
    ChatMessage,
    CompiledMessagesResult,
    ContextItem,
    ContextItemWithId,
    ContextSubmenuItem,
    DiffLine,
    ExperimentalModelRoles,
    FileSymbolMap,
    IdeSettings,
    LLMFullCompletionOptions,
    McpUiState,
    MessageOption,
    ModelDescription,
    PromptLog,
    RangeInFile,
    SerializedAgentConfig,
    Session,
    Skill,
    SlashCommandDescWithSource,
    StreamDiffLinesPayload,
    ToolCall
} from "../";
import { ProfileDescription } from "../config/ProfileLifecycleManager";

import { AgentErrorReason } from "../util/errors";

export enum OnboardingModes {
  API_KEY = "API Key",
  LOCAL = "Local",
}

export interface ListHistoryOptions {
  offset?: number;
  limit?: number;
}

export type ToCoreFromIdeOrWebviewProtocol = {
  // Special
  ping: [string, string];
  abort: [undefined, void];
  cancelApply: [undefined, void];

  // History
  "history/list": [
    ListHistoryOptions,
    (BaseSessionMetadata | any)[],
  ];
  "history/delete": [{ id: string }, void];
  "history/load": [{ id: string }, Session];
  "history/save": [Session, void];
  "history/share": [{ id: string; outputDir?: string }, void];
  "history/clear": [undefined, void];
  "config/addOpenAiKey": [string, void];
  "config/addModel": [
    {
      model: SerializedAgentConfig["models"][number];
      role?: keyof ExperimentalModelRoles;
      roles?: ModelRole[];
    },
    void,
  ];
  "config/addMcpServer": [MCPServer, void];
  "config/updateMcpServer": [
    { originalName: string; server: MCPServer },
    void,
  ];
  "config/updateModel": [
    {
      title: string;
      model: SerializedAgentConfig["models"][number];
    },
    void,
  ];
  "config/addRule": [
    {
      name: string;
      content: string;
      description?: string;
      globs?: string;
      regex?: string;
      alwaysApply?: boolean;
      invokable?: boolean;
    },
    void,
  ];
  "config/updateRule": [
    {
      ruleId: string;
      name?: string;
      content?: string;
      description?: string;
      globs?: string;
      regex?: string;
      alwaysApply?: boolean;
      invokable?: boolean;
    },
    void,
  ];
  "config/deleteRule": [{ ruleId: string }, void];
  "config/addPrompt": [
    {
      name: string;
      prompt: string;
      description?: string;
    },
    void,
  ];
  "config/updatePrompt": [
    {
      promptId: string;
      name?: string;
      prompt?: string;
      description?: string;
    },
    void,
  ];
  "config/deletePrompt": [{ promptId: string }, void];
  "config/listSkills": [
    undefined,
    Array<
      Pick<Skill, "name" | "description" | "sourceFile"> & {
        /** Workspace-relative path (or absolute URI for global skills). */
        displayPath: string;
        scope: "workspace" | "global";
      }
    >,
  ];
  "config/deleteMcpServer": [{ name: string }, void];
  "config/ideSettingsUpdate": [IdeSettings, void];
  "config/getSerializedProfileInfo": [
    undefined,
    {
      result: ConfigResult<BrowserSerializedAgentConfig>;
      profileId: string | null;
      profiles: ProfileDescription[];
    },
  ];
  "config/deleteModel": [{ title: string }, void];
  "config/refreshProfiles": [
    (
      | undefined
      | {
          reason?: string;
          selectProfileId?: string;
        }
    ),
    void,
  ];
  "config/openProfile": [
    {
      profileId: string | undefined;
      element?: { sourceFile?: string };
    },
    void,
  ];
  "config/updateSharedConfig": [SharedConfigSchema, SharedConfigSchema];
  "config/updateSelectedModel": [
    {
      profileId: string;
      role: ModelRole;
      title: string | null;
    },
    GlobalContextModelSelections,
  ];
  "context/getContextItems": [
    {
      name: string;
      query: string;
      fullInput: string;
      selectedCode: RangeInFile[];
      isInAgentMode: boolean;
    },
    ContextItemWithId[],
  ];

  "mcp/reloadServer": [
    {
      id: string;
    },
    void,
  ];
  "mcp/setServerEnabled": [{ id: string; enabled: boolean }, void];
  "mcp/getPrompt": [
    {
      serverName: string;
      promptName: string;
      args?: Record<string, string>;
    },
    {
      prompt: string;
      description: string | undefined;
    },
  ];
  "context/getSymbolsForFiles": [{ uris: string[] }, FileSymbolMap];
  "context/loadSubmenuItems": [{ title: string }, ContextSubmenuItem[]];
  "autocomplete/complete": [AutocompleteInput, string[]];
  "autocomplete/cancel": [undefined, void];
  "autocomplete/accept": [{ completionId: string }, void];
  "llm/complete": [
    {
      prompt: string;
      completionOptions: LLMFullCompletionOptions;
      title: string;
    },
    string,
  ];
  "llm/listModels": [{ title: string }, string[] | undefined];
  "llm/streamChat": [
    {
      messages: ChatMessage[];
      completionOptions: LLMFullCompletionOptions;
      title: string;
      messageOptions?: MessageOption;
      legacySlashCommandData?: {
        command: SlashCommandDescWithSource;
        input: string;
        contextItems: ContextItemWithId[];
        historyIndex: number;
        selectedCode: RangeInFile[];
      };
    },
    AsyncGenerator<ChatMessage, PromptLog>,
  ];
  streamDiffLines: [StreamDiffLinesPayload, AsyncGenerator<DiffLine>];
  getDiffLines: [{ oldContent: string; newContent: string }, DiffLine[]];
  "llm/compileChat": [
    { messages: ChatMessage[]; options: LLMFullCompletionOptions },
    CompiledMessagesResult,
  ];
  "chatDescriber/describe": [
    {
      text: string;
    },
    string | undefined,
  ];
  "conversation/compact": [
    {
      index: number;
      sessionId: string;
    },
    string | undefined,
  ];
  "stats/getTokensPerDay": [
    undefined,
    { day: string; promptTokens: number; generatedTokens: number }[],
  ];
  "stats/getTokensPerModel": [
    undefined,
    { model: string; promptTokens: number; generatedTokens: number }[],
  ];
  "tts/kill": [undefined, void];

  // File changes
  "files/changed": [{ uris?: string[] }, void];
  "files/opened": [{ uris?: string[] }, void];
  "files/created": [{ uris?: string[] }, void];
  "files/deleted": [{ uris?: string[] }, void];
  "files/closed": [{ uris?: string[] }, void];

  addAutocompleteModel: [{ model: ModelDescription }, void];

  "tools/call": [
    { toolCall: ToolCall },
    {
      contextItems: ContextItem[];
      errorMessage?: string;
      errorReason?: AgentErrorReason;
      mcpUiState?: McpUiState;
    },
  ];
  "tools/evaluatePolicy": [
    {
      toolName: string;
      basePolicy: ToolPolicy;
      parsedArgs: Record<string, unknown>;
      processedArgs?: Record<string, unknown>;
    },
    { policy: ToolPolicy; displayValue?: string },
  ];
  "tools/preprocessArgs": [
    { toolName: string; args: Record<string, unknown> },
    {
      preprocessedArgs?: Record<string, unknown>;
      errorReason?: AgentErrorReason;
      errorMessage?: string;
    },
  ];
  isItemTooBig: [{ item: ContextItemWithId }, boolean];
  "process/markAsBackgrounded": [{ toolCallId: string }, void];
  "process/isBackgrounded": [{ toolCallId: string }, boolean];
  "process/killTerminalProcess": [{ toolCallId: string }, void];
};
