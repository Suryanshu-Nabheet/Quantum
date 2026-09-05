import {
  AgentSettings,
  ConfigResult,
  ConfigValidationError,
  ModelRole,
  ResolvedAgentSettings,
} from "agent-config";

import {
  AgentConfig,
  IDE,
  IdeInfo,
  IdeSettings,
  ILLMLogger,
  InternalMcpOptions,
} from "../..";
import { MCPManagerSingleton } from "../../context/mcp/MCPManagerSingleton";

import TransformersJsEmbeddingsProvider from "../../llm/llms/TransformersJsEmbeddingsProvider";
import { GlobalContext } from "../../util/GlobalContext";
import { modifyAnyConfigWithSharedConfig } from "../sharedConfig";

import { convertPromptBlockToSlashCommand } from "../../commands/slash/promptBlockSlashCommand";

import { getBaseToolDefinitions } from "../../tools";
import { loadConfigContextProviders } from "../loadContextProviders";
import {
  getGuiRules,
  migrateLegacyGuiConfigIfNeeded,
  quantumSettingsMcpUri,
  quantumSettingsPromptUri,
  quantumSettingsRuleUri,
} from "../util";
import {
  convertBlockRuleToAgentRule,
  convertMcpConfigToInternalMcpOptions,
} from "./convert";
import { llmsFromModelConfig } from "./models";

function loadAgentSettingsFromStorage(
  override?: AgentSettings,
): ConfigResult<AgentSettings> {
  if (override) {
    return {
      config: override,
      errors: [],
      configLoadInterrupted: false,
    };
  }

  const globalContext = new GlobalContext();
  const config: AgentSettings = {
    name: "Quantum Settings",
    version: "1.0.0",
    models: globalContext.get("guiModels") ?? [],
    mcpServers: (globalContext.get("guiMcpServers") ?? []).map((server) => ({
      ...server,
      sourceFile: quantumSettingsMcpUri(server.name),
    })),
    rules: getGuiRules().map((rule) => ({
      name: rule.name,
      rule: rule.rule,
      description: rule.description,
      globs: rule.globs,
      regex: rule.regex,
      alwaysApply: rule.alwaysApply,
      invokable: rule.invokable,
      sourceFile: quantumSettingsRuleUri(rule.id),
    })),
    prompts: (globalContext.get("guiPrompts") ?? []).map((prompt) => ({
      name: prompt.name,
      description: prompt.description,
      prompt: prompt.prompt,
      invokable: prompt.invokable ?? true,
      sourceFile: quantumSettingsPromptUri(prompt.id),
    })),
    context: [],
  };

  return {
    config,
    errors: [],
    configLoadInterrupted: false,
  };
}

function sanitizeAgentSettings(
  agentSettings: AgentSettings,
): ResolvedAgentSettings {
  return {
    ...agentSettings,
    data: agentSettings.data?.filter((k) => !!k),
    context: agentSettings.context?.filter((k) => !!k),
    docs: agentSettings.docs?.filter((k) => !!k) as any,
    mcpServers: agentSettings.mcpServers?.filter((k) => !!k),
    models: agentSettings.models?.filter((k) => !!k),
    prompts: agentSettings.prompts?.filter((k) => !!k),
    rules: agentSettings.rules?.filter((k) => !!k).map((k) => k!),
  };
}

export async function buildAgentConfigFromGui(options: {
  agentSettings: AgentSettings;
  ide: IDE;
  ideInfo: IdeInfo;
  uniqueId: string;
  llmLogger: ILLMLogger;
}): Promise<{ config: AgentConfig; errors: ConfigValidationError[] }> {
  const { agentSettings, ide, ideInfo, uniqueId, llmLogger } = options;

  const localErrors: ConfigValidationError[] = [];

  const agentConfig: AgentConfig = {
    slashCommands: [],
    tools: getBaseToolDefinitions(),
    mcpServerStatuses: [],
    contextProviders: [],
    modelsByRole: {
      chat: [],
      edit: [],
      apply: [],
      embed: [],
      autocomplete: [],
      rerank: [],
      subagent: [],
    },
    selectedModelByRole: {
      chat: null,
      edit: null,
      apply: null,
      embed: null,
      autocomplete: null,
      rerank: null,
      subagent: null,
    },
    rules: [],
    requestOptions: { ...agentSettings.requestOptions },
  };

  const config = sanitizeAgentSettings(agentSettings);

  for (const rule of config.rules ?? []) {
    agentConfig.rules.push(convertBlockRuleToAgentRule(rule));
  }

  config.prompts?.forEach((prompt) => {
    try {
      const slashCommand = convertPromptBlockToSlashCommand(prompt);
      agentConfig.slashCommands?.push(slashCommand);
    } catch (e) {
      localErrors.push({
        message: `Error loading prompt ${prompt.name}: ${e instanceof Error ? e.message : e}`,
        fatal: false,
      });
    }
  });

  let warnAboutFreeTrial = false;
  const defaultModelRoles: ModelRole[] = [
    "chat",
    "apply",
    "edit",
    "autocomplete",
  ];
  for (const model of config.models ?? []) {
    model.roles = model.roles ?? defaultModelRoles;

    if (model.provider === "free-trial") {
      warnAboutFreeTrial = true;
    }
    try {
      const llms = await llmsFromModelConfig({
        model,
        uniqueId,
        llmLogger,
        config: agentConfig,
      });

      if (model.roles?.includes("chat")) {
        agentConfig.modelsByRole.chat.push(...llms);
      }
      if (model.roles?.includes("apply")) {
        agentConfig.modelsByRole.apply.push(...llms);
      }
      if (model.roles?.includes("edit")) {
        agentConfig.modelsByRole.edit.push(...llms);
      }
      if (model.roles?.includes("autocomplete")) {
        agentConfig.modelsByRole.autocomplete.push(...llms);
      }
      if (model.roles?.includes("embed")) {
        if (model.provider === "transformers.js") {
          agentConfig.modelsByRole.embed.push(
            new TransformersJsEmbeddingsProvider(),
          );
        } else {
          agentConfig.modelsByRole.embed.push(...llms);
        }
      }
      if (model.roles?.includes("rerank")) {
        agentConfig.modelsByRole.rerank.push(...llms);
      }
      if (model.roles?.includes("subagent")) {
        agentConfig.modelsByRole.subagent.push(...llms);
      }
    } catch (e) {
      localErrors.push({
        fatal: false,
        message: `Failed to load model:\nName: ${model.name}\nModel: ${model.model}\nProvider: ${model.provider}\n${e instanceof Error ? e.message : e}`,
      });
    }
  }

  if (warnAboutFreeTrial) {
    localErrors.push({
      fatal: false,
      message:
        "Model provider 'free-trial' is no longer supported, will be ignored.",
    });
  }

  const { providers, errors: contextErrors } = loadConfigContextProviders(
    config.context,
    ideInfo.ideType,
  );
  agentConfig.contextProviders = providers;
  localErrors.push(...contextErrors);

  const mcpManager = MCPManagerSingleton.getInstance();
  const mcpOptions: InternalMcpOptions[] = (config.mcpServers ?? []).map(
    (server) =>
      convertMcpConfigToInternalMcpOptions(server, config.requestOptions),
  );
  mcpManager.setConnections(mcpOptions, false, { ide });

  return { config: agentConfig, errors: localErrors };
}

export async function loadAgentConfigFromGui(options: {
  ide: IDE;
  ideSettings: IdeSettings;
  ideInfo: IdeInfo;
  uniqueId: string;
  llmLogger: ILLMLogger;
  overrideAgentSettings?: AgentSettings;
}): Promise<ConfigResult<AgentConfig>> {
  const { ide, ideInfo, uniqueId, llmLogger, overrideAgentSettings } = options;

  if (!overrideAgentSettings) {
    await migrateLegacyGuiConfigIfNeeded(ide);
  }

  const settingsResult = loadAgentSettingsFromStorage(overrideAgentSettings);

  if (!settingsResult.config || settingsResult.configLoadInterrupted) {
    return {
      errors: settingsResult.errors,
      config: undefined,
      configLoadInterrupted: true,
    };
  }

  const { config: agentConfig, errors: localErrors } =
    await buildAgentConfigFromGui({
      agentSettings: settingsResult.config,
      ide,
      ideInfo,
      uniqueId,
      llmLogger,
    });

  const sharedConfig = new GlobalContext().getSharedConfig();
  const withShared = modifyAnyConfigWithSharedConfig(agentConfig, sharedConfig);

  return {
    config: withShared,
    errors: [...(settingsResult.errors ?? []), ...localErrors],
    configLoadInterrupted: false,
  };
}
