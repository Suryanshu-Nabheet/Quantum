import z from "zod";

import {
  BrowserSerializedAgentConfig,
  Config,
  AgentConfig,
  SerializedAgentConfig,
} from "..";

export const sharedConfigSchema = z
  .object({
    // boolean fields persisted in shared config (GUI)

    disableSessionTitles: z.boolean(),

    // User preferences (stored in shared config, applied to `ui` / `experimental`)
    readResponseTTS: z.boolean(),
    onlyUseSystemMessageTools: z.boolean(),

    // `ui` in `AgentConfig`
    showSessionTabs: z.boolean(),
    codeBlockToolbarPosition: z.enum(["top", "bottom"]),
    fontSize: z.number(),
    codeWrap: z.boolean(),
    displayRawMarkdown: z.boolean(),
    showChatScrollbar: z.boolean(),
    resumeAfterToolRejection: z.boolean(),

    // `tabAutocompleteOptions` in `AgentConfig`
    useAutocompleteCache: z.boolean(),
    useAutocompleteMultilineCompletions: z.enum(["always", "never", "auto"]),
    disableAutocompleteInFiles: z.array(z.string()),
    modelTimeout: z.number(),
    debounceDelay: z.number(),
    autocompleteFirstTokenMs: z.number(),
  })
  .partial();

export type SharedConfigSchema = z.infer<typeof sharedConfigSchema>;

// For security in case of damaged config file, try to salvage any security-related values
export function salvageSharedConfig(sharedConfig: object): SharedConfigSchema {
  const salvagedConfig: SharedConfigSchema = {};

  if ("disableSessionTitles" in sharedConfig) {
    const val = z.boolean().safeParse(sharedConfig.disableSessionTitles);
    if (val.success) {
      salvagedConfig.disableSessionTitles = val.data;
    }
  }
  if ("disableAutocompleteInFiles" in sharedConfig) {
    const val = sharedConfigSchema.shape.disableAutocompleteInFiles.safeParse(
      sharedConfig.disableAutocompleteInFiles,
    );
    if (val.success) {
      salvagedConfig.disableAutocompleteInFiles = val.data;
    }
  }
  return salvagedConfig;
}

// Apply shared config to all forms of config
// - SerializedAgentConfig (legacy type)
// - Config ("intermediate") - intermediate config type
// - AgentConfig
// - BrowserSerializedAgentConfig (final converted to be passed to GUI)

// This modify function is split into two steps
// - rectifySharedModelsFromSharedConfig - includes boolean flags which
//   must be added BEFORE remote server config apply for JSON
//   for security reasons
// - setSharedModelsFromSharedConfig - exists because of selectedModelsByRole
//   Which don't exist on SerializedAgentConfig/Config types, so must be added after the fact
export function modifyAnyConfigWithSharedConfig<
  T extends
    | AgentConfig
    | BrowserSerializedAgentConfig
    | Config
    | SerializedAgentConfig,
>(agentConfig: T, sharedConfig: SharedConfigSchema): T {
  const configCopy = { ...agentConfig };
  configCopy.tabAutocompleteOptions = {
    ...configCopy.tabAutocompleteOptions,
  };
  if (sharedConfig.useAutocompleteCache !== undefined) {
    configCopy.tabAutocompleteOptions.useCache =
      sharedConfig.useAutocompleteCache;
  }
  if (sharedConfig.useAutocompleteMultilineCompletions !== undefined) {
    configCopy.tabAutocompleteOptions.multilineCompletions =
      sharedConfig.useAutocompleteMultilineCompletions;
  }
  if (sharedConfig.disableAutocompleteInFiles !== undefined) {
    configCopy.tabAutocompleteOptions.disableInFiles =
      sharedConfig.disableAutocompleteInFiles;
  }
  if (sharedConfig.modelTimeout !== undefined) {
    configCopy.tabAutocompleteOptions.modelTimeout = sharedConfig.modelTimeout;
  }
  if (sharedConfig.debounceDelay !== undefined) {
    configCopy.tabAutocompleteOptions.debounceDelay =
      sharedConfig.debounceDelay;
  }
  if (sharedConfig.autocompleteFirstTokenMs !== undefined) {
    configCopy.tabAutocompleteOptions.showWhateverWeHaveAtXMs =
      sharedConfig.autocompleteFirstTokenMs;
  }

  configCopy.ui = {
    ...configCopy.ui,
  };

  if (sharedConfig.codeBlockToolbarPosition !== undefined) {
    configCopy.ui.codeBlockToolbarPosition =
      sharedConfig.codeBlockToolbarPosition;
  }
  if (sharedConfig.fontSize !== undefined) {
    configCopy.ui.fontSize = sharedConfig.fontSize;
  }
  if (sharedConfig.codeWrap !== undefined) {
    configCopy.ui.codeWrap = sharedConfig.codeWrap;
  }
  if (sharedConfig.displayRawMarkdown !== undefined) {
    configCopy.ui.displayRawMarkdown = sharedConfig.displayRawMarkdown;
  }
  if (sharedConfig.showChatScrollbar !== undefined) {
    configCopy.ui.showChatScrollbar = sharedConfig.showChatScrollbar;
  }


  if (sharedConfig.disableSessionTitles !== undefined) {
    configCopy.disableSessionTitles = sharedConfig.disableSessionTitles;
  }

  if (sharedConfig.showSessionTabs !== undefined) {
    configCopy.ui.showSessionTabs = sharedConfig.showSessionTabs;
  }

  if (sharedConfig.resumeAfterToolRejection !== undefined) {
    configCopy.ui.resumeAfterToolRejection =
      sharedConfig.resumeAfterToolRejection;
  }

  configCopy.experimental = {
    ...configCopy.experimental,
  };

  if (sharedConfig.readResponseTTS !== undefined) {
    configCopy.ui.readResponseTTS = sharedConfig.readResponseTTS;
  }

  if (sharedConfig.onlyUseSystemMessageTools !== undefined) {
    configCopy.experimental.onlyUseSystemMessageTools =
      sharedConfig.onlyUseSystemMessageTools;
  }

  return configCopy;
}
