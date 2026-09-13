import { ToolPolicy } from "terminal-security";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RuleWithSource, Tool } from "core";
import { BUILT_IN_GROUP_NAME } from "core/tools/builtIn";
import type {
  AgentAccessMode,
  TerminalAutoExecution,
} from "core/tools/policies/agentAccess";
import {
  DEFAULT_AGENT_ACCESS_MODE,
  DEFAULT_TERMINAL_AUTO_EXECUTION,
} from "core/tools/policies/agentAccess";
export type RulePolicy = "on" | "off";

export type ToolGroupPolicy = "include" | "exclude";

export type { AgentAccessMode, TerminalAutoExecution };

export type ToolPolicies = { [toolName: string]: ToolPolicy };
export type RulePolicies = { [ruleName: string]: RulePolicy };
export type ToolGroupPolicies = { [toolGroupName: string]: ToolGroupPolicy };
export type ReasoningSettings = { [modelTitle: string]: boolean };

type UIState = {
  showDialog: boolean;
  dialogMessage: JSX.Element | undefined;
  shouldAddFileForEditing: boolean;
  toolSettings: ToolPolicies;
  toolGroupSettings: ToolGroupPolicies;
  ruleSettings: RulePolicies;
  reasoningSettings: ReasoningSettings;
  ttsActive: boolean;
  /** High-level machine/filesystem access for the agent. */
  agentAccessMode: AgentAccessMode;
  /** Whether terminal commands auto-run or need approval. */
  terminalAutoExecution: TerminalAutoExecution;
};

export const DEFAULT_TOOL_SETTING: ToolPolicy = "allowedWithoutPermission";
export const DEFAULT_RULE_SETTING: RulePolicy = "on";
export const DEFAULT_UI_SLICE: UIState = {
  showDialog: false,
  dialogMessage: undefined,
  shouldAddFileForEditing: false,
  ttsActive: false,
  toolSettings: {},
  toolGroupSettings: {
    [BUILT_IN_GROUP_NAME]: "include",
  },
  ruleSettings: {},
  reasoningSettings: {},
  agentAccessMode: DEFAULT_AGENT_ACCESS_MODE,
  terminalAutoExecution: DEFAULT_TERMINAL_AUTO_EXECUTION,
};

export const uiSlice = createSlice({
  name: "ui",
  initialState: DEFAULT_UI_SLICE,
  reducers: {
    setDialogMessage: (
      state,
      action: PayloadAction<UIState["dialogMessage"]>,
    ) => {
      state.dialogMessage = action.payload;
    },
    setShowDialog: (state, action: PayloadAction<UIState["showDialog"]>) => {
      state.showDialog = action.payload;
    },
    // Tools
    addTool: (state, action: PayloadAction<Tool>) => {
      state.toolSettings[action.payload.function.name] =
        action.payload.defaultToolPolicy ?? DEFAULT_TOOL_SETTING;
    },
    setToolPolicy: (
      state,
      action: PayloadAction<{
        toolName: string;
        policy: ToolPolicy;
      }>,
    ) => {
      state.toolSettings[action.payload.toolName] = action.payload.policy;
    },
    clearToolPolicy: (state, action: PayloadAction<string>) => {
      delete state.toolSettings[action.payload];
    },
    toggleToolGroupSetting: (state, action: PayloadAction<string>) => {
      const setting = state.toolGroupSettings[action.payload] ?? "include";

      if (setting === "include") {
        state.toolGroupSettings[action.payload] = "exclude";
      } else {
        state.toolGroupSettings[action.payload] = "include";
      }
    },
    // Rules
    addRule: (state, action: PayloadAction<RuleWithSource>) => {
      state.ruleSettings[action.payload.name!] = DEFAULT_RULE_SETTING;
    },
    toggleRuleSetting: (state, action: PayloadAction<string>) => {
      const setting = state.ruleSettings[action.payload];

      switch (setting) {
        case "on":
          state.ruleSettings[action.payload] = "off";
          break;
        case "off":
          state.ruleSettings[action.payload] = "on";
          break;
        default:
          state.ruleSettings[action.payload] = DEFAULT_RULE_SETTING;
          break;
      }
    },
    setTTSActive: (state, { payload }: PayloadAction<boolean>) => {
      state.ttsActive = payload;
    },
    setReasoningSetting: (
      state,
      action: PayloadAction<{ modelTitle: string; enabled: boolean }>,
    ) => {
      state.reasoningSettings[action.payload.modelTitle] =
        action.payload.enabled;
    },
    setAgentAccessMode: (state, action: PayloadAction<AgentAccessMode>) => {
      state.agentAccessMode = action.payload;
    },
    setTerminalAutoExecution: (
      state,
      action: PayloadAction<TerminalAutoExecution>,
    ) => {
      state.terminalAutoExecution = action.payload;
    },
  },
});

export const {
  setDialogMessage,
  setShowDialog,
  setToolPolicy,
  clearToolPolicy,
  toggleToolGroupSetting,
  addTool,
  addRule,
  toggleRuleSetting,
  setTTSActive,
  setReasoningSetting,
  setAgentAccessMode,
  setTerminalAutoExecution,
} = uiSlice.actions;

export default uiSlice.reducer;
