import {
    ToCoreFromWebviewProtocol,
    ToWebviewFromCoreProtocol,
} from "./coreWebview.js";

// Message types to pass through from webview to core (VS Code webview ↔ in-process Core).
// Keep this list aligned with handlers in Core and the GUI messenger.
export const WEBVIEW_TO_CORE_PASS_THROUGH: (keyof ToCoreFromWebviewProtocol)[] =
  [
    "ping",
    "abort",
    "history/list",
    "history/delete",
    "history/load",

    "history/save",
    "history/clear",
    "config/addModel",
    "config/updateModel",
    "config/addMcpServer",
    "config/updateMcpServer",
    "config/addRule",
    "config/updateRule",
    "config/addPrompt",
    "config/updatePrompt",
    "config/deletePrompt",
    "config/listSkills",
    "config/deleteMcpServer",
    "config/ideSettingsUpdate",
    "config/deleteRule",
    "config/getSerializedProfileInfo",
    "config/deleteModel",
    "config/refreshProfiles",
    "config/openProfile",
    "config/updateSharedConfig",
    "config/updateSelectedModel",
    "mcp/reloadServer",
    "mcp/getPrompt",
    "mcp/setServerEnabled",
    "context/getContextItems",
    "context/getSymbolsForFiles",
    "context/loadSubmenuItems",
    "autocomplete/complete",
    "autocomplete/cancel",
    "autocomplete/accept",
    "tts/kill",
    "llm/complete",
    "llm/streamChat",
    "llm/listModels",
    "llm/compileChat",
    "streamDiffLines",
    "chatDescriber/describe",
    "conversation/compact",
    "stats/getTokensPerDay",
    "stats/getTokensPerModel",
    "addAutocompleteModel",
    "didChangeSelectedProfile",
    "tools/call",
    "tools/evaluatePolicy",
    "tools/preprocessArgs",

    "isItemTooBig",
    "process/markAsBackgrounded",
    "process/isBackgrounded",
    "process/killTerminalProcess",
  ];

// Message types to pass through from core to webview (VS Code webview).
// Keep this list aligned with GUI subscribers and Core send paths.
export const CORE_TO_WEBVIEW_PASS_THROUGH: (keyof ToWebviewFromCoreProtocol)[] =
  [
    "configUpdate",
    "addContextItem",
    "refreshSubmenuItems",
    "isAgentInputFocused",
    "setTTSActive",
    "getWebviewHistoryLength",
    "getCurrentSessionId",
    "sessionUpdate",
    "didCloseFiles",
    "toolCallPartialOutput",
  ];
