import {
  ModelRole,
  PromptTemplates,
  ToolOverrideConfig,
} from "agent-config";
import { ToolPolicy } from "terminal-security";
import { McpUiResourceMeta } from "@modelcontextprotocol/ext-apps";
import { TextResourceContents } from "@modelcontextprotocol/sdk/types.js";
import { LLMConfigurationStatuses } from "./llm/constants";

declare global {
  interface Window {
    ide?: "vscode";
    windowId: string;
    vscMediaUrl: string;
    fullColorTheme?: {
      rules?: {
        token?: string;
        foreground?: string;
      }[];
    };
    colorThemeName?: string;
    workspacePaths?: string[];
  }
}

export interface ChunkWithoutID {
  content: string;
  startLine: number;
  endLine: number;
  signature?: string;
  otherMetadata?: { [key: string]: any };
}

export interface Chunk extends ChunkWithoutID {
  digest: string;
  filepath: string;
  index: number; // Index of the chunk in the document at filepath
}

export type PromptTemplateFunction = (
  history: ChatMessage[],
  otherData: Record<string, string>,
) => string | ChatMessage[];

export type PromptTemplate = string | PromptTemplateFunction;

type RequiredLLMOptions =
  | "uniqueId"
  | "contextLength"
  | "embeddingId"
  | "maxEmbeddingChunkSize"
  | "maxEmbeddingBatchSize"
  | "completionOptions";

export interface ILLM
  extends Omit<LLMOptions, RequiredLLMOptions>,
  Required<Pick<LLMOptions, RequiredLLMOptions>> {
  get providerName(): string;
  get underlyingProviderName(): string;

  autocompleteOptions?: Partial<TabAutocompleteOptions>;

  lastRequestId?: string;

  complete(
    prompt: string,
    signal: AbortSignal,
    options?: LLMFullCompletionOptions,
  ): Promise<string>;

  streamComplete(
    prompt: string,
    signal: AbortSignal,
    options?: LLMFullCompletionOptions,
  ): AsyncGenerator<string, PromptLog>;

  streamFim(
    prefix: string,
    suffix: string,
    signal: AbortSignal,
    options?: LLMFullCompletionOptions,
  ): AsyncGenerator<string, PromptLog>;

  streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options?: LLMFullCompletionOptions,
    messageOptions?: MessageOption,
  ): AsyncGenerator<ChatMessage, PromptLog>;

  chat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options?: LLMFullCompletionOptions,
  ): Promise<ChatMessage>;

  compileChatMessages(
    messages: ChatMessage[],
    options: LLMFullCompletionOpeions,
  ): CompiledChatMessagesReport;

  embed(chunks: string[]): Promise<number[][]>;

  rerank(query: string, chunks: Chunk[]): Promise<number[]>;

  countTokens(text: string): number;

  supportsImages(): boolean;

  supportsCompletions(): boolean;

  supportsPrefill(): boolean;

  supportsFim(): boolean;

  listModels(): Promise<string[]>;

  renderPromptTemplate(
    template: PromptTemplate,
    history: ChatMessage[],
    otherData: Record<string, string>,
    canPutWordsInModelsMouth?: boolean,
  ): string | ChatMessage[];

  getConfigurationStatus(): LLMConfigurationStatuses;
}

export interface ModelInstaller {
  installModel(
    modelName: string,
    signal: AbortSignal,
    progressReporter?: (task: string, increment: number, total: number) => void,
  ): Promise<any>;

  isInstallingModel(modelName: string): Promise<boolean>;
}

export type ContextProviderType = "normal" | "query" | "submenu";

export interface ContextProviderDescription {
  title: ContextProviderName;
  displayTitle: string;
  description: string;
  renderInlineAs?: string;
  type: ContextProviderType;
}

export type FetchFunction = (url: string | URL, init?: any) => Promise<any>;

export interface ContextProviderExtras {
  config: AgentConfig;
  fullInput: string;
  embeddingsProvider: ILLM | null;
  reranker: ILLM | null;
  llm: ILLM;
  ide: IDE;
  selectedCode: RangeInFile[];
  fetch: FetchFunction;
  isInAgentMode: boolean;
}

export interface LoadSubmenuItemsArgs {
  config: AgentConfig;
  ide: IDE;
  fetch: FetchFunction;
}

export interface CustomContextProvider {
  title: string;
  displayTitle?: string;
  description?: string;
  renderInlineAs?: string;
  type?: ContextProviderType;
  loadSubmenuItems?: (
    args: LoadSubmenuItemsArgs,
  ) => Promise<ContextSubmenuItem[]>;

  getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]>;
}

export interface ContextSubmenuItem {
  id: string;
  title: string;
  description: string;
  icon?: string;
  metadata?: any;
}

export interface ContextSubmenuItemWithProvider extends ContextSubmenuItem {
  providerTitle: string;
}


export interface IContextProvider {
  get description(): ContextProviderDescription;

  getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]>;

  loadSubmenuItems(args: LoadSubmenuItemsArgs): Promise<ContextSubmenuItem[]>;

  get deprecationMessage(): string | null;
}

export interface SessionUsage extends Usage {
  /** Total cumulative cost in USD for all LLM API calls in this session */
  totalCost: number;
}

export interface Session {
  sessionId: string;
  title: string;
  workspaceDirectory: string;
  history: ChatHistoryItem[];
  /** Optional: per-session UI mode (chat/agent/plan/background) */
  mode?: MessageModes;
  /** Optional: title of the selected chat model for this session */
  chatModelTitle?: string | null;
  /** Optional: cumulative usage and cost for all LLM API calls in this session */
  usage?: SessionUsage;
}

export interface BaseSessionMetadata {
  sessionId: string;
  title: string;
  dateCreated: string;
  workspaceDirectory: string;
  messageCount?: number;
}

export interface RangeInFile {
  filepath: string;
  range: Range;
}

export interface Location {
  filepath: string;
  position: Position;
}

export interface FileWithContents {
  filepath: string;
  contents: string;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface Position {
  line: number;
  character: number;
}

export interface FileEdit {
  filepath: string;
  range: Range;
  replacement: string;
}

export interface CompletionOptions extends BaseCompletionOptions {
  model: string;
}

export type ChatMessageRole =
  | "user"
  | "assistant"
  | "thinking"
  | "system"
  | "tool";

export type TextMessagePart = {
  type: "text";
  text: string;
};

export type ImageMessagePart = {
  type: "imageUrl";
  imageUrl: { url: string };
};

export type MessagePart = TextMessagePart | ImageMessagePart;

export type MessageContent = string | MessagePart[];

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolCallDelta {
  id?: string;
  type?: "function";
  function?: {
    name?: string;
    arguments?: string;
  };
}

export interface ToolResultChatMessage {
  role: "tool";
  content: string;
  toolCallId: string;
  /** Arbitrary per-message metadata (IDs, provider-specific info, etc.) */
  metadata?: Record<string, unknown>;
}

export interface UserChatMessage {
  role: "user";
  content: MessageContent;
  /** Arbitrary per-message metadata (IDs, provider-specific info, etc.) */
  metadata?: Record<string, unknown>;
}

export interface ThinkingChatMessage {
  role: "thinking";
  content: MessageContent;
  signature?: string;
  redactedThinking?: string;
  toolCalls?: ToolCallDelta[];
  reasoning_details?: {
    signature?: string;
    [key: string]: any;
  }[];
  /** Arbitrary per-message metadata (IDs, provider-specific info, etc.) */
  metadata?: Record<string, unknown>;
}

/**
 * This is meant to be equivalent to the OpenAI [usage object](https://platform.openai.com/docs/api-reference/chat/object#chat/object-usage)
 * but potentially with additional information that is needed for other providers.
 */
export interface Usage {
  completionTokens: number;
  promptTokens: number;
  promptTokensDetails?: {
    cachedTokens?: number;
    /** This an Anthropic-specific property */
    cacheWriteTokens?: number;
    audioTokens?: number;
  };
  completionTokensDetails?: {
    acceptedPredictionTokens?: number;
    reasoningTokens?: number;
    rejectedPredictionTokens?: number;
    audioTokens?: number;
  };
}

export interface AssistantChatMessage {
  role: "assistant";
  content: MessageContent;
  toolCalls?: ToolCallDelta[];
  usage?: Usage;
  /** Arbitrary per-message metadata (IDs, provider-specific info, etc.) */
  metadata?: Record<string, unknown>;
}

export interface SystemChatMessage {
  role: "system";
  content: string;
  /** Arbitrary per-message metadata (IDs, provider-specific info, etc.) */
  metadata?: Record<string, unknown>;
}

export type ChatMessage =
  | UserChatMessage
  | AssistantChatMessage
  | ThinkingChatMessage
  | SystemChatMessage
  | ToolResultChatMessage;

export interface ContextItemId {
  providerTitle: string;
  itemId: string;
}

export type ContextItemUriTypes = "file" | "url";

export interface ContextItemUri {
  type: ContextItemUriTypes;
  value: string;
}

export interface ContextItem {
  content: string;
  name: string;
  description: string;
  editing?: boolean;
  editable?: boolean;
  icon?: string;
  uri?: ContextItemUri;
  hidden?: boolean;
  status?: string;
}

export interface ContextItemWithId extends ContextItem {
  id: ContextItemId;
}

export interface InputModifiers {
  noContext: boolean;
}

export interface SymbolWithRange extends RangeInFile {
  name: string;
  type: string;
  content: string;
}

export type FileSymbolMap = Record<string, SymbolWithRange[]>;

export interface PromptLog {
  modelTitle: string;
  modelProvider: string;
  prompt: string;
  completion: string;
}

export type MessageModes = "chat" | "agent" | "plan";

export type ToolStatus =
  | "generating" // Tool call arguments are being streamed from the LLM
  | "generated" // Tool call is complete and ready for execution (awaiting approval)
  | "calling" // Tool is actively being executed
  | "errored" // Tool execution failed with an error
  | "done" // Tool execution completed successfully
  | "canceled"; // Tool call was canceled by user or system

interface McpUiResourceContents extends TextResourceContents {
  _meta?: {
    ui?: McpUiResourceMeta;
  };
}

interface McpUiState {
  content: McpUiResourceContents;
}

// Will exist only on "assistant" messages with tool calls
interface ToolCallState {
  toolCallId: string;
  toolCall: ToolCall;
  status: ToolStatus;
  parsedArgs: any;
  processedArgs?: Record<string, any>; // Added in preprocesing step
  output?: ContextItem[];
  tool?: Tool;
  mcpUiState?: McpUiState;
}

interface Reasoning {
  active: boolean;
  text: string;
  startAt: number;
  endAt?: number;
}

export interface ChatHistoryItem {
  message: ChatMessage;
  contextItems: ContextItemWithId[];
  editorState?: any;
  modifiers?: InputModifiers;
  promptLogs?: PromptLog[];
  toolCallStates?: ToolCallState[];
  isGatheringContext?: boolean;
  reasoning?: Reasoning;
  appliedRules?: RuleMetadata[];
  conversationSummary?: string;
}

export interface LLMFullCompletionOptions extends BaseCompletionOptions {
  log?: boolean;
  model?: string;
}

export type ToastType = "info" | "error" | "warning";

export interface LLMInteractionBase {
  interactionId: string;
  timestamp: number;
}

export interface LLMInteractionStartChat extends LLMInteractionBase {
  kind: "startChat";
  messages: ChatMessage[];
  options: CompletionOptions;
  provider: string;
}

export interface LLMInteractionStartComplete extends LLMInteractionBase {
  kind: "startComplete";
  prompt: string;
  options: CompletionOptions;
  provider: string;
}

export interface LLMInteractionStartFim extends LLMInteractionBase {
  kind: "startFim";
  prefix: string;
  suffix: string;
  options: CompletionOptions;
  provider: string;
}

export interface LLMInteractionChunk extends LLMInteractionBase {
  kind: "chunk";
  chunk: string;
}

export interface LLMInteractionMessage extends LLMInteractionBase {
  kind: "message";
  message: ChatMessage;
}

export interface LLMInteractionEnd extends LLMInteractionBase {
  promptTokens: number;
  generatedTokens: number;
  thinkingTokens: number;
  usage: Usage | undefined;
}

export interface LLMInteractionSuccess extends LLMInteractionEnd {
  kind: "success";
}

export interface LLMInteractionCancel extends LLMInteractionEnd {
  kind: "cancel";
}

export interface LLMInteractionError extends LLMInteractionEnd {
  kind: "error";
  name: string;
  message: string;
}

export type LLMInteractionItem =
  | LLMInteractionStartChat
  | LLMInteractionStartComplete
  | LLMInteractionStartFim
  | LLMInteractionChunk
  | LLMInteractionMessage
  | LLMInteractionSuccess
  | LLMInteractionCancel
  | LLMInteractionError;

// When we log a LLM interaction, we want to add the interactionId and timestamp
// in the logger code, so we need a type that omits these members from *each*
// member of the union. This can be done by using the distributive behavior of
// conditional types in Typescript.
//
// www.typescriptlang.org/docs/handbook/2/conditional-types.html#distributive-conditional-types
// https://stackoverflow.com/questions/57103834/typescript-omit-a-property-from-all-interfaces-in-a-union-but-keep-the-union-s
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

export type LLMInteractionItemDetails = DistributiveOmit<
  LLMInteractionItem,
  "interactionId" | "timestamp"
>;

export interface ILLMInteractionLog {
  logItem(item: LLMInteractionItemDetails): void;
}

export interface ILLMLogger {
  createInteractionLog(): ILLMInteractionLog;
}

export interface LLMOptions {
  model: string;
  apiBase?: string;

  title?: string;
  uniqueId?: string;
  baseAgentSystemMessage?: string;
  basePlanSystemMessage?: string;
  baseChatSystemMessage?: string;
  autocompleteOptions?: Partial<TabAutocompleteOptions>;
  contextLength?: number;
  maxStopWords?: number;
  completionOptions?: CompletionOptions;
  requestOptions?: RequestOptions;
  template?: TemplateType;
  promptTemplates?: Partial<Record<keyof PromptTemplates, PromptTemplate>>;
  templateMessages?: (messages: ChatMessage[]) => string;
  logger?: ILLMLogger;
  llmRequestHook?: (model: string, prompt: string) => any;
  apiKey?: string;
  cacheBehavior?: CacheBehavior;
  capabilities?: ModelCapability;
  roles?: ModelRole[];
  apiKeyLocation?: string;
  envSecretLocations?: Record<string, string>;


  useLegacyCompletionsEndpoint?: boolean;

  // Embedding options
  embeddingId?: string;
  maxEmbeddingChunkSize?: number;
  maxEmbeddingBatchSize?: number;

  // Cloudflare options
  accountId?: string;

  // Azure options
  deployment?: string;
  apiVersion?: string;
  apiType?: string;

  // AWS options
  profile?: string;
  modelArn?: string;
  accessKeyId?: string;
  secretAccessKey?: string;

  // AWS and VertexAI Options
  region?: string;

  // VertexAI and Watsonx Options
  projectId?: string;

  // IBM watsonx Options
  deploymentId?: string;

  env?: Record<string, string | number | boolean>;

  sourceFile?: string;
  isFromAutoDetect?: boolean;

  /** Tool overrides for this model */
  toolOverrides?: ToolOverride[];
}

type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<
  T,
  Exclude<keyof T, Keys>
> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

export interface CustomLLMWithOptionals {
  options: LLMOptions;
  streamCompletion?: (
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
    fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  ) => AsyncGenerator<string>;
  streamChat?: (
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
    fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  ) => AsyncGenerator<ChatMessage | string>;
  listModels?: (
    fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  ) => Promise<string[]>;
}

/**
 * The LLM interface requires you to specify either `streamCompletion` or `streamChat` (or both).
 */
export type CustomLLM = RequireAtLeastOne<
  CustomLLMWithOptionals,
  "streamCompletion" | "streamChat"
>;

// IDE

export type DiffType = "new" | "old" | "same";

export interface DiffObject {
  type: DiffType;
}

export interface DiffLine extends DiffObject {
  line: string;
}

interface DiffChar extends DiffObject {
  char: string;
  oldIndex?: number; // Character index assuming a flattened line string.
  newIndex?: number;
  oldCharIndexInLine?: number; // Character index assuming new lines reset the character index to 0.
  newCharIndexInLine?: number;
  oldLineIndex?: number;
  newLineIndex?: number;
}

export interface Problem {
  filepath: string;
  range: Range;
  message: string;
}

export interface Thread {
  name: string;
  id: number;
}

export type IdeType = "vscode";

export interface IdeInfo {
  ideType: IdeType;
  name: string;
  version: string;
  remoteName: string;
  extensionVersion: string;
  isPrerelease: boolean;
}

export enum FileType {
  Unkown = 0,
  File = 1,
  Directory = 2,
  SymbolicLink = 64,
}

export interface IdeSettings { }

export interface FileStats {
  size: number;
  lastModified: number;
}

/** Map of file name to stats */
export type FileStatsMap = {
  [path: string]: FileStats;
};

export interface IDE {
  getIdeInfo(): Promise<IdeInfo>;

  getIdeSettings(): Promise<IdeSettings>;

  getDiff(includeUnstaged: boolean): Promise<string[]>;

  getClipboardContent(): Promise<{ text: string; copiedAt: string }>;


  isWorkspaceRemote(): Promise<boolean>;

  getUniqueId(): Promise<string>;

  getTerminalContents(): Promise<string>;

  getDebugLocals(threadIndex: number): Promise<string>;

  getTopLevelCallStackSources(
    threadIndex: number,
    stackDepth: number,
  ): Promise<string[]>;

  getAvailableThreads(): Promise<Thread[]>;

  getWorkspaceDirs(): Promise<string[]>;

  fileExists(fileUri: string): Promise<boolean>;

  writeFile(path: string, contents: string): Promise<void>;

  removeFile(path: string): Promise<void>;

  showVirtualFile(title: string, contents: string): Promise<void>;

  openFile(path: string): Promise<void>;

  openUrl(url: string): Promise<void>;

  getExternalUri?(uri: string): Promise<string>;

  runCommand(command: string, options?: TerminalOptions): Promise<void>;

  saveFile(fileUri: string): Promise<void>;

  readFile(fileUri: string): Promise<string>;

  readRangeInFile(fileUri: string, range: Range): Promise<string>;

  showLines(fileUri: string, startLine: number, endLine: number): Promise<void>;

  getOpenFiles(): Promise<string[]>;

  getCurrentFile(): Promise<
    | undefined
    | {
      isUntitled: boolean;
      path: string;
      contents: string;
    }
  >;

  getPinnedFiles(): Promise<string[]>;

  getSearchResults(query: string, maxResults?: number): Promise<string>;

  getFileResults(
    pattern: string,
    maxResults?: number,
    options?: { includeMedia?: boolean },
  ): Promise<string[]>;

  /** Read a file as a data URL for multimodal attach (images). Optional. */
  readFileAsDataUrl?(
    fileUri: string,
    maxBytes?: number,
  ): Promise<string | undefined>;

  subprocess(command: string, cwd?: string): Promise<[string, string]>;

  getProblems(fileUri?: string | undefined): Promise<Problem[]>;

  getBranch(dir: string): Promise<string>;

  getRepoName(dir: string): Promise<string | undefined>;

  showToast(
    type: ToastType,
    message: string,
    ...otherParams: any[]
  ): Promise<any>;

  getGitRootPath(dir: string): Promise<string | undefined>;

  listDir(dir: string): Promise<[string, FileType][]>;

  getFileStats(files: string[]): Promise<FileStatsMap>;

  // Secret Storage
  readSecrets(keys: string[]): Promise<Record<string, string>>;

  writeSecrets(secrets: { [key: string]: string }): Promise<void>;

  // LSP
  gotoDefinition(location: Location): Promise<RangeInFile[]>;
  gotoTypeDefinition(location: Location): Promise<RangeInFile[]>;
  getSignatureHelp(location: Location): Promise<SignatureHelp | null>;
  getReferences(location: Location): Promise<RangeInFile[]>;
  getDocumentSymbols(textDocumentIdentifier: string): Promise<DocumentSymbol[]>;

  // Callbacks
  onDidChangeActiveTextEditor(callback: (fileUri: string) => void): void;

  // Integrated browser (Quantum workbench)
  getBrowserPages(): Promise<AgentBrowserPageSummary[]>;
  getBrowserPageContext(browserId: string): Promise<string | undefined>;
  ensureBrowserPageShared(browserId: string): Promise<boolean>;
  invokeBrowserTool(
    toolId: string,
    parameters: Record<string, unknown>,
  ): Promise<string>;
}

// Slash Commands

export interface AgentSDK {
  ide: IDE;
  llm: ILLM;
  addContextItem: (item: ContextItemWithId) => void;
  history: ChatMessage[];
  input: string;
  params?: { [key: string]: any } | undefined;
  contextItems: ContextItemWithId[];
  selectedCode: RangeInFile[];
  config: AgentConfig;
  fetch: FetchFunction;
  completionOptions?: LLMFullCompletionOptions;
  abortController: AbortController;
}

/* Be careful changing SlashCommand or SlashCommandDescription */
export interface SlashCommandDescription {
  name: string;
  description: string;
  prompt?: string;
  params?: { [key: string]: any };
}

export interface SlashCommand extends SlashCommandDescription {
  run: (sdk: AgentSDK) => AsyncGenerator<string | undefined>;
}

export interface SlashCommandWithSource extends SlashCommandDescription {
  run?: (sdk: AgentSDK) => AsyncGenerator<string | undefined>; // Optional - only needed for legacy
  source: SlashCommandSource;
  sourceFile?: string;
  slug?: string;
  overrideSystemMessage?: string;
}

export type SlashCommandSource =
  | "built-in"
  | "quantum-settings-prompt"
  | "mcp-prompt"
  | "invokable-rule";

export interface SlashCommandDescWithSource extends SlashCommandDescription {
  isLegacy: boolean; // Maps to if slashcommand.run exists
  source: SlashCommandSource;
  sourceFile?: string;
  slug?: string;
  mcpServerName?: string;
  mcpArgs?: MCPPromptArgs;
}

// Config

/** Context providers with a local implementation in core/context/providers */
export type ContextProviderName =
  | "file"
  | "folder"
  | "search"
  | "diff"
  | "terminal"
  | "problems"
  | "rules"
  | "branch"
  | "commit"
  | "mcp"
  | "browser"
  | string;

export type TemplateType =
  | "llama2"
  | "alpaca"
  | "zephyr"
  | "phi2"
  | "phind"
  | "anthropic"
  | "chatml"
  | "none"
  | "openchat"
  | "deepseek"
  | "xwin-coder"
  | "neural-chat"
  | "codellama-70b"
  | "llava"
  | "gemma"
  | "granite"
  | "llama3"
  | "codestral";

export interface RequestOptions {
  timeout?: number;
  verifySsl?: boolean;
  caBundlePath?: string | string[];
  proxy?: string;
  headers?: { [key: string]: string };
  extraBodyProperties?: { [key: string]: any };
  noProxy?: string[];
  clientCertificate?: ClientCertificateOptions;
}

export interface CacheBehavior {
  cacheSystemMessage?: boolean;
  cacheConversation?: boolean;
}

export interface ClientCertificateOptions {
  cert: string;
  key: string;
  passphrase?: string;
}

export interface ContextProviderWithParams {
  name: ContextProviderName;
  params: { [key: string]: any };
}

export interface Prediction {
  type: "content";
  content:
  | string
  | {
    type: "text";
    text: string;
  }[];
}

export interface ToolExtras {
  ide: IDE;
  llm: ILLM;
  fetch: FetchFunction;
  tool: Tool;
  toolCallId?: string;
  onPartialOutput?: (params: {
    toolCallId: string;
    contextItems: ContextItem[];
  }) => void;
  config: AgentConfig;
}

export interface McpToolMeta {
  ui?: {
    resourceUri?: string;
  };
  "ui/resourceUri"?: string;
}

export interface Tool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, any>;
    strict?: boolean | null;
  };
  displayTitle: string;
  wouldLikeTo?: string;
  isCurrently?: string;
  hasAlready?: string;
  readonly: boolean;
  isInstant?: boolean;
  uri?: string;
  faviconUrl?: string;
  group: string;
  originalFunctionName?: string;
  systemMessageDescription?: {
    prefix: string;
    exampleArgs?: Array<[string, string | number]>;
  };
  defaultToolPolicy?: ToolPolicy;
  toolCallIcon?: string;
  preprocessArgs?: (
    args: Record<string, unknown>,
    extras: {
      ide: IDE;
    },
  ) => Promise<Record<string, unknown>>;
  evaluateToolCallPolicy?: (
    basePolicy: ToolPolicy,
    parsedArgs: Record<string, unknown>,
    processedArgs?: Record<string, unknown>,
  ) => ToolPolicy;
  mcpMeta?: McpToolMeta;
}

/**
 * Configuration for overriding built-in tool prompts.
 * Extends ToolOverrideConfig with required name for array usage.
 */
export type ToolOverride = ToolOverrideConfig & {
  /** Tool name to override (matches function.name, e.g., "read_file") */
  name: string;
};

interface ToolChoice {
  type: "function";
  function: {
    name: string;
  };
}

export interface ConfigDependentToolParams {
  rules: RuleWithSource[];
  isSignedIn: boolean;
  modelName: string | undefined;
  ide: IDE;
  enableHeavyTools?: boolean;
}

export type GetTool = (params: ConfigDependentToolParams) => Promise<Tool>;

export interface BaseCompletionOptions {
  temperature?: number;
  topP?: number;
  topK?: number;
  minP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  mirostat?: number;
  stop?: string[];
  maxTokens?: number;
  numThreads?: number;
  useMmap?: boolean;
  keepAlive?: number;
  numGpu?: number;
  raw?: boolean;
  stream?: boolean;
  prediction?: Prediction;
  tools?: Tool[];
  toolChoice?: ToolChoice;
  reasoning?: boolean;
  reasoningBudgetTokens?: number;
  promptCaching?: boolean;
}

export interface ModelCapability {
  uploadImage?: boolean;
  tools?: boolean;
}

export interface ModelDescription {
  title: string;
  provider: string;
  underlyingProviderName: string;
  model: string;
  apiKey?: string;

  apiBase?: string;
  apiKeyLocation?: string;
  envSecretLocations?: Record<string, string>;
  onPremProxyUrl?: string | null;

  contextLength?: number;
  maxStopWords?: number;
  template?: TemplateType;
  completionOptions?: BaseCompletionOptions;
  baseAgentSystemMessage?: string;
  basePlanSystemMessage?: string;
  baseChatSystemMessage?: string;
  requestOptions?: RequestOptions;
  promptTemplates?: { [key: string]: string };
  cacheBehavior?: CacheBehavior;
  capabilities?: ModelCapability;
  roles?: ModelRole[];
  configurationStatus?: LLMConfigurationStatuses;

  sourceFile?: string;
  isFromAutoDetect?: boolean;

  /** Tool overrides for this model */
  toolOverrides?: ToolOverride[];

  /** Provider-specific env (Azure deployment, Watsonx, etc.) for Configure UI. */
  deployment?: string;
  apiVersion?: string;
  apiType?: "openai" | "azure";
  deploymentId?: string;
  projectId?: string;
  region?: string;
  profile?: string;
  accountId?: string;
}

export interface JSONEmbedOptions {
  apiBase?: string;
  apiKey?: string;
  model?: string;
  deployment?: string;
  apiType?: string;
  apiVersion?: string;
  requestOptions?: RequestOptions;
  maxEmbeddingChunkSize?: number;
  maxEmbeddingBatchSize?: number;

  // AWS options
  profile?: string;

  // AWS and VertexAI Options
  region?: string;

  // VertexAI and Watsonx Options
  projectId?: string;
}

export interface EmbeddingsProviderDescription extends JSONEmbedOptions {
  provider: string;
}

export interface RerankerDescription {
  name: string;
  params?: { [key: string]: any };
}

export interface TabAutocompleteOptions {
  disable: boolean;
  maxPromptTokens: number;
  debounceDelay: number;
  modelTimeout: number;
  maxSuffixPercentage: number;
  prefixPercentage: number;
  transform?: boolean;
  template?: string;
  multilineCompletions: "always" | "never" | "auto";
  useCache: boolean;
  onlyMyCode: boolean;
  useRecentlyOpened: boolean;
  disableInFiles?: string[];
  showWhateverWeHaveAtXMs?: number;
  experimental_includeDiff: boolean | number;
}

export interface StdioOptions {
  type: "stdio";
  command: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface WebSocketOptions {
  type: "websocket";
  url: string;
  requestOptions?: RequestOptions;
}

export interface SSEOptions {
  type: "sse";
  url: string;
  requestOptions?: RequestOptions;
}

export interface StreamableHTTPOptions {
  type: "streamable-http";
  url: string;
  requestOptions?: RequestOptions;
}

export type TransportOptions =
  | StdioOptions
  | WebSocketOptions
  | SSEOptions
  | StreamableHTTPOptions;

export type MCPConnectionStatus =
  | "disabled"
  | "connecting"
  | "connected"
  | "error"
  | "authenticating"
  | "not-connected";

export type MCPPromptArgs = {
  name: string;
  description?: string;
  required?: boolean;
}[];

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: MCPPromptArgs;
}

// https://modelcontextprotocol.io/docs/concepts/resources#direct-resources
export interface MCPResource {
  name: string;
  uri: string;
  description?: string;
  mimeType?: string;
}

// https://modelcontextprotocol.io/docs/concepts/resources#resource-templates
export interface MCPResourceTemplate {
  uriTemplate: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, any>;
  };
  _meta?: Record<string, unknown> | undefined;
}

type BaseInternalMCPOptions = {
  id: string;
  name: string;
  faviconUrl?: string;
  timeout?: number;
  requestOptions?: RequestOptions;
  sourceFile?: string;
};

export type InternalStdioMcpOptions = BaseInternalMCPOptions & {
  type?: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
};

export type InternalStreamableHttpMcpOptions = BaseInternalMCPOptions & {
  type?: "streamable-http";
  url: string;
  apiKey?: string;
};

export type InternalSseMcpOptions = BaseInternalMCPOptions & {
  type?: "sse";
  url: string;
  apiKey?: string;
};

export type InternalWebsocketMcpOptions = BaseInternalMCPOptions & {
  type: "websocket"; // websocket requires explicit type
  url: string;
};

export type InternalMcpOptions =
  | InternalStdioMcpOptions
  | InternalStreamableHttpMcpOptions
  | InternalSseMcpOptions
  | InternalWebsocketMcpOptions;

export type MCPServerStatus = InternalMcpOptions & {
  status: MCPConnectionStatus;
  errors: string[];
  infos: string[];
  isProtectedResource: boolean;
  prompts: MCPPrompt[];
  tools: MCPTool[];
  resources: MCPResource[];
  resourceTemplates: MCPResourceTemplate[];
  sourceFile?: string;
};

export interface AgentUIConfig {
  codeBlockToolbarPosition?: "top" | "bottom";
  fontSize?: number;
  displayRawMarkdown?: boolean;
  showChatScrollbar?: boolean;
  codeWrap?: boolean;
  showSessionTabs?: boolean;
  resumeAfterToolRejection?: boolean;
  /** Read LLM chat responses aloud using system TTS */
  readResponseTTS?: boolean;
}

export interface ContextMenuConfig {
  comment?: string;
  docstring?: string;
  fix?: string;
  optimize?: string;
  fixGrammar?: string;
}

export interface ExperimentalModelRoles {
  repoMapFileSelection?: string;
  inlineEdit?: string;
  applyCodeBlock?: string;
}

export interface ExperimentalMCPOptions {
  transport: TransportOptions;
  faviconUrl?: string;
  timeout?: number;
}

export type ApplyStateStatus =
  | "not-started" // Apply state created but not necessarily streaming
  | "streaming" // Changes are being applied to the file
  | "done" // All changes have been applied, awaiting user to accept/reject
  | "closed"; // All changes have been applied. Note that for new files, we immediately set the status to "closed"

export interface ApplyState {
  streamId: string;
  status?: ApplyStateStatus;
  numDiffs?: number;
  filepath?: string;
  fileContent?: string;
  originalFileContent?: string;
  toolCallId?: string;
  autoFormattingDiff?: string;
}

export type StreamDiffLinesType = "edit" | "apply";
interface StreamDiffLinesOptionsBase {
  type: StreamDiffLinesType;
  prefix: string;
  highlighted: string;
  suffix: string;
  input: string;
  language: string | undefined;
  modelTitle: string | undefined;
  includeRulesInSystemMessage: boolean;
  fileUri?: string;
}

interface StreamDiffLinesOptionsEdit extends StreamDiffLinesOptionsBase {
  type: "edit";
}

interface StreamDiffLinesOptionsApply extends StreamDiffLinesOptionsBase {
  type: "apply";
  newCode: string;
}

type StreamDiffLinesPayload =
  | StreamDiffLinesOptionsApply
  | StreamDiffLinesOptionsEdit;

export interface HighlightedCodePayload {
  rangeInFileWithContents: RangeInFileWithContents;
  prompt?: string;
  shouldRun?: boolean;
}

export interface AcceptOrRejectDiffPayload {
  filepath?: string;
  streamId?: string;
}

export interface ShowFilePayload {
  filepath: string;
}

export interface ApplyToFilePayload {
  streamId: string;
  filepath?: string;
  text: string;
  toolCallId?: string;
  isSearchAndReplace?: boolean;
}

export interface RangeInFileWithContents {
  filepath: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  contents: string;
}

export type SetCodeToEditPayload = RangeInFileWithContents | FileWithContents;

/**
 * Signature help represents the signature of something
 * callable. There can be multiple signatures but only one
 * active and only one active parameter.
 */
export class SignatureHelp {
  /**
   * One or more signatures.
   */
  signatures: SignatureInformation[];

  /**
   * The active signature.
   */
  activeSignature: number;

  /**
   * The active parameter of the active signature.
   */
  activeParameter: number;
}

/**
 * Represents the signature of something callable. A signature
 * can have a label, like a function-name, a doc-comment, and
 * a set of parameters.
 */
export class SignatureInformation {
  /**
   * The label of this signature. Will be shown in
   * the UI.
   */
  label: string;

  /**
   * The parameters of this signature.
   */
  parameters: ParameterInformation[];

  /**
   * The index of the active parameter.
   *
   * If provided, this is used in place of {@linkcode SignatureHelp.activeParameter}.
   */
  activeParameter?: number;
}

/**
 * Represents a parameter of a callable-signature. A parameter can
 * have a label and a doc-comment.
 */
export class ParameterInformation {
  /**
   * The label of this signature.
   *
   * Either a string or inclusive start and exclusive end offsets within its containing
   * {@link SignatureInformation.label signature label}. *Note*: A label of type string must be
   * a substring of its containing signature information's {@link SignatureInformation.label label}.
   */
  label: string | [number, number];
}

export type DefaultContextProvider = ContextProviderWithParams & {
  query?: string;
};

export interface ExperimentalConfig {
  contextMenuPrompts?: ContextMenuConfig;
  modelRoles?: ExperimentalModelRoles;
  defaultContext?: DefaultContextProvider[];
  onlyUseSystemMessageTools?: boolean;
}


export interface JSONModelDescription {
  title: string;
  provider: string;
  underlyingProviderName: string;
  model: string;
  apiKey?: string;
  apiBase?: string;

  contextLength?: number;
  maxStopWords?: number;
  template?: TemplateType;
  completionOptions?: BaseCompletionOptions;
  systemMessage?: string;
  requestOptions?: RequestOptions;
  cacheBehavior?: CacheBehavior;

  region?: string;
  profile?: string;
  modelArn?: string;
  apiType?: "openai" | "azure";
  apiVersion?: string;
  deployment?: string;
  projectId?: string;
  accountId?: string;
  useLegacyCompletionsEndpoint?: boolean;
  deploymentId?: string;
  isFromAutoDetect?: boolean;
}

export interface SerializedAgentConfig {
  env?: string[];

  models: JSONModelDescription[];
  systemMessage?: string;
  completionOptions?: BaseCompletionOptions;
  requestOptions?: RequestOptions;
  slashCommands?: SlashCommandDescription[];
  contextProviders?: ContextProviderWithParams[];
  disableSessionTitles?: boolean;

  embeddingsProvider?: EmbeddingsProviderDescription;
  tabAutocompleteModel?: JSONModelDescription | JSONModelDescription[];
  tabAutocompleteOptions?: Partial<TabAutocompleteOptions>;
  ui?: AgentUIConfig;
  reranker?: RerankerDescription;
  experimental?: ExperimentalConfig;


}

export type ConfigMergeType = "merge" | "overwrite";

export type AgentRcJson = Partial<SerializedAgentConfig> & {
  mergeBehavior: ConfigMergeType;
};

// Intermediate config type - gives users simplified interfaces
export interface Config {

  /** Each entry is a JSONModelDescription or CustomLLM.
   * A CustomLLM requires you only to define an AsyncGenerator that calls the LLM and yields string updates. You can choose to define either `streamCompletion` or `streamChat` (or both).
   * Agent will do the rest of the work to construct prompt templates, handle context items, prune context, etc.
   */
  models: (CustomLLM | JSONModelDescription)[];
  /** A system message to be followed by all of your models */
  systemMessage?: string;
  /** The default completion options for all models */
  completionOptions?: BaseCompletionOptions;
  /** Request options that will be applied to all models and context providers */
  requestOptions?: RequestOptions;
  /** The list of slash commands that will be available in the sidebar */
  slashCommands?: (SlashCommand | SlashCommandWithSource)[];
  /** Each entry is a ContextProviderWithParams or CustomContextProvider.
   * A CustomContextProvider requires you only to define a title and getContextItems function. When you type '@title <query>', Agent will call `getContextItems(query)`.
   */
  contextProviders?: (CustomContextProvider | ContextProviderWithParams)[];
  /** If set to true, Agent will not make extra requests to the LLM to generate a summary title of each session. */
  disableSessionTitles?: boolean;

  /** The provider used to calculate embeddings. If left empty, Agent will use transformers.js to calculate the embeddings with all-MiniLM-L6-v2 */
  embeddingsProvider?: EmbeddingsProviderDescription | ILLM;
  /** The model that Agent will use for tab autocompletions. */
  tabAutocompleteModel?:
  | CustomLLM
  | JSONModelDescription
  | (CustomLLM | JSONModelDescription)[];
  /** Options for tab autocomplete */
  tabAutocompleteOptions?: Partial<TabAutocompleteOptions>;
  /** UI styles customization */
  ui?: AgentUIConfig;
  /** Options for the reranker */
  reranker?: RerankerDescription | ILLM;
  /** Experimental configuration */
  experimental?: ExperimentalConfig;


}

// in the actual Agent source code
export interface AgentConfig {

  // systemMessage?: string;
  completionOptions?: BaseCompletionOptions;
  requestOptions?: RequestOptions;
  slashCommands: SlashCommandWithSource[];
  contextProviders: IContextProvider[];
  disableSessionTitles?: boolean;

  tabAutocompleteOptions?: Partial<TabAutocompleteOptions>;
  ui?: AgentUIConfig;
  experimental?: ExperimentalConfig;

  tools: Tool[];
  mcpServerStatuses: MCPServerStatus[];
  rules: RuleWithSource[];
  modelsByRole: Record<ModelRole, ILLM[]>;
  selectedModelByRole: Record<ModelRole, ILLM | null>;

}

export interface BrowserSerializedAgentConfig {

  // systemMessage?: string;
  completionOptions?: BaseCompletionOptions;
  requestOptions?: RequestOptions;
  slashCommands: SlashCommandDescWithSource[];
  contextProviders: ContextProviderDescription[];
  disableSessionTitles?: boolean;

  ui?: AgentUIConfig;
  experimental?: ExperimentalConfig;

  tools: Omit<Tool, "preprocessArgs", "evaluateToolCallPolicy">[];
  mcpServerStatuses: MCPServerStatus[];
  rules: RuleWithSource[];
  tabAutocompleteOptions?: Partial<TabAutocompleteOptions>;
  modelsByRole: Record<ModelRole, ModelDescription[]>;
  selectedModelByRole: Record<ModelRole, ModelDescription | null>;
}

// DOCS SUGGESTIONS AND PACKAGE INFO
export interface FilePathAndName {
  path: string;
  name: string;
}

export interface PackageFilePathAndName extends FilePathAndName {
  packageRegistry: string; // e.g. npm, pypi
}

export type ParsedPackageInfo = {
  name: string;
  packageFile: PackageFilePathAndName;
  language: string;
  version: string;
};

export type PackageDetails = {
  docsLink?: string;
  docsLinkWarning?: string;
  title?: string;
  description?: string;
  repo?: string;
  license?: string;
};

export type PackageDetailsSuccess = PackageDetails & {
  docsLink: string;
};

export type PackageDocsResult = {
  packageInfo: ParsedPackageInfo;
} & (
    | { error: string; details?: never }
    | { details: PackageDetailsSuccess; error?: never }
  );

export interface TerminalOptions {
  reuseTerminal?: boolean;
  terminalName?: string;
  waitForCompletion?: boolean;
}

export type RuleSource =
  | "default-chat"
  | "default-plan"
  | "default-agent"
  | "model-options-chat"
  | "model-options-plan"
  | "model-options-agent"
  | "rules-block"
  | "colocated-markdown"
  | "json-systemMessage"
  | ".agentrules"
  | "agentFile"
  | "quantum-settings";

export interface RuleMetadata {
  name?: string;
  slug?: string;
  source: RuleSource;
  globs?: string | string[];
  regex?: string | string[];
  description?: string;
  sourceFile?: string;
  alwaysApply?: boolean;
  invokable?: boolean;
}
export interface RuleWithSource extends RuleMetadata {
  rule: string;
}

export interface Skill {
  name: string;
  description: string;
  path: string;
  content: string;
  files: string[];
  license?: string;
  /** Absolute URI of the SKILL.md file, for opening it in the editor. */
  sourceFile?: string;
}

export interface CompleteOnboardingPayload {
  mode: OnboardingModes;
  provider?: string;
  apiKey?: string;
}

export interface CompiledMessagesResult {
  compiledChatMessages: ChatMessage[];
  didPrune: boolean;
  contextPercentage: number;
}

export interface AddToChatPayload {
  data: AddToChatPayloadItem[];
}

export interface AgentBrowserPageSummary {
  id: string;
  title: string;
  url: string;
  resource: string;
  sharingState: "shared" | "notShared" | "unavailable";
  isActive: boolean;
}

export interface AttachBrowserContextPayload {
  name: string;
  description: string;
  content: string;
  uri?: string;
  providerTitle?: string;
}

interface AddToChatPayloadItem {
  type: "file" | "folder";
  fullPath: string;
  name: string;
}

export interface MessageOption {
  precompiled: boolean;
}

/* LSP-specific interfaces. */

// See https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#symbolKind.
// We shift this one index down to match vscode.SymbolKind.
export enum SymbolKind {
  File = 0,
  Module = 1,
  Namespace = 2,
  Package = 3,
  Class = 4,
  Method = 5,
  Property = 6,
  Field = 7,
  Constructor = 8,
  Enum = 9,
  Interface = 10,
  Function = 11,
  Variable = 12,
  Constant = 13,
  String = 14,
  Number = 15,
  Boolean = 16,
  Array = 17,
  Object = 18,
  Key = 19,
  Null = 20,
  EnumMember = 21,
  Struct = 22,
  Event = 23,
  Operator = 24,
  TypeParameter = 25,
}

// See https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#symbolTag.
export namespace SymbolTag {
  export const Deprecated: 1 = 1;
}

// See https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#symbolTag.
export type SymbolTag = 1;

// See https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#documentSymbol.
export interface DocumentSymbol {
  name: string;
  detail?: string;
  kind: SymbolKind;
  tags?: SymbolTag[];
  deprecated?: boolean;
  range: Range;
  selectionRange: Range;
  children?: DocumentSymbol[];
}
