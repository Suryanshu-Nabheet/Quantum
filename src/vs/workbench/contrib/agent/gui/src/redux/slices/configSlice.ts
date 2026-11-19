import { ConfigResult, ConfigValidationError } from "agent-config";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { BrowserSerializedAgentConfig, ModelDescription } from "core";
export type ConfigState = {
  configError: ConfigValidationError[] | undefined;
  config: BrowserSerializedAgentConfig;
  loading: boolean;
};

export const EMPTY_CONFIG: BrowserSerializedAgentConfig = {
  slashCommands: [],
  contextProviders: [],
  tools: [],
  mcpServerStatuses: [],
  modelsByRole: {
    chat: [],
    apply: [],
    edit: [],
    autocomplete: [],
    rerank: [],
    embed: [],
    subagent: [],
  },
  configuredModels: [],
  selectedModelByRole: {
    chat: null,
    apply: null,
    edit: null,
    autocomplete: null,
    rerank: null,
    embed: null,
    subagent: null,
  },
  rules: [],
};

export const INITIAL_CONFIG_SLICE: ConfigState = {
  configError: undefined,
  config: EMPTY_CONFIG,
  loading: false,
};

export const configSlice = createSlice({
  name: "config",
  initialState: INITIAL_CONFIG_SLICE,
  reducers: {
    setConfigResult: (
      state,
      {
        payload: result,
      }: PayloadAction<ConfigResult<BrowserSerializedAgentConfig>>,
    ) => {
      const { config, errors } = result;
      if (!errors || errors.length === 0) {
        state.configError = undefined;
      } else {
        state.configError = errors;
      }

      // If an error is found in config on save,
      // We must invalidate the GUI config too,
      // Since core won't be able to load config
      // Don't invalidate the loaded config
      if (!config) {
        state.config = EMPTY_CONFIG;
      } else {
        state.config = config;
      }
      state.loading = false;
    },
    updateConfig: (
      state,
      { payload: config }: PayloadAction<BrowserSerializedAgentConfig>,
    ) => {
      state.config = config;
    },
    removeProviderModels: (
      state,
      { payload: providerId }: PayloadAction<string>,
    ) => {
      const normalizedProviderId = providerId.trim().toLowerCase();
      const belongsToProvider = (model: ModelDescription | null) =>
        !!model &&
        (model.underlyingProviderName || model.provider || "unknown")
          .trim()
          .toLowerCase() === normalizedProviderId;

      for (const role of Object.keys(state.config.modelsByRole) as Array<
        keyof typeof state.config.modelsByRole
      >) {
        state.config.modelsByRole[role] = state.config.modelsByRole[
          role
        ].filter((model) => !belongsToProvider(model));
      }
      state.config.configuredModels = (
        state.config.configuredModels ?? []
      ).filter((model) => !belongsToProvider(model));
      for (const role of Object.keys(state.config.selectedModelByRole) as Array<
        keyof typeof state.config.selectedModelByRole
      >) {
        if (belongsToProvider(state.config.selectedModelByRole[role])) {
          state.config.selectedModelByRole[role] = null;
        }
      }
    },
    setConfigLoading: (state, { payload: loading }: PayloadAction<boolean>) => {
      state.loading = loading;
    },
  },
  selectors: {
    selectSelectedChatModel: (state) => {
      return state.config.selectedModelByRole.chat;
    },
    selectUIConfig: (state) => {
      return state.config?.ui ?? null;
    },
  },
});

export const {
  updateConfig,
  removeProviderModels,
  setConfigResult,
  setConfigLoading,
} =
  configSlice.actions;

export const { selectUIConfig, selectSelectedChatModel } =
  configSlice.selectors;

export default configSlice.reducer;
