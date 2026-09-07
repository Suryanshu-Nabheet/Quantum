import { AgentSettings, ConfigResult, ConfigValidationError } from "agent-config";

import {
    AgentConfig,
    IDE,
    ILLMLogger,
    RuleWithSource,
    Tool,
} from "../../";
import { convertRuleBlockToSlashCommand } from "../../commands/slash/ruleBlockSlashCommand";
import { MCPManagerSingleton } from "../../context/mcp/MCPManagerSingleton";
import MCPContextProvider from "../../context/providers/MCPContextProvider";


import { initSlashCommand } from "../../promptFiles/initPrompt";
import { getConfigDependentToolDefinitions } from "../../tools";
import { encodeMCPToolUri } from "../../tools/callTool";
import { getMCPToolName } from "../../tools/mcpToolName";
import { GlobalContext } from "../../util/GlobalContext";
import { CodebaseRulesCache } from "../markdown/loadCodebaseRules";
import { loadProjectAgentMarkdownRules } from "../markdown/loadMarkdownRules";
import { rectifySelectedModelsFromGlobalContext } from "../selectedModels";
import { loadAgentConfigFromGui } from "../gui/loadGuiConfig";

async function loadRules(ide: IDE) {
  const rules: RuleWithSource[] = [];
  const errors = [];

  const { rules: projectAgentRules, errors: projectAgentErrors } =
    await loadProjectAgentMarkdownRules(ide);
  rules.unshift(...projectAgentRules);
  errors.push(...projectAgentErrors);

  const codebaseRulesCache = CodebaseRulesCache.getInstance();
  rules.unshift(...codebaseRulesCache.rules);
  errors.push(...codebaseRulesCache.errors);

  return { rules, errors };
}

export default async function doLoadConfig(options: {
  ide: IDE;
  llmLogger: ILLMLogger;
  overrideAgentSettings?: AgentSettings;
  profileId: string;
}): Promise<ConfigResult<AgentConfig>> {
  const { ide, llmLogger, overrideAgentSettings, profileId } = options;

  const ideInfo = await ide.getIdeInfo();
  const uniqueId = await ide.getUniqueId();
  const ideSettings = await ide.getIdeSettings();


  let newConfig: AgentConfig | undefined;
  let errors: ConfigValidationError[] | undefined;
  let configLoadInterrupted = false;

  const result = await loadAgentConfigFromGui({
    ide,
    ideSettings,
    ideInfo,
    uniqueId,
    llmLogger,
    overrideAgentSettings,
  });
  newConfig = result.config;
  errors = result.errors;
  configLoadInterrupted = result.configLoadInterrupted;

  if (configLoadInterrupted || !newConfig) {
    return { errors, config: newConfig, configLoadInterrupted: true };
  }

  // Remove ability have undefined errors, just have an array
  errors = [...(errors ?? [])];

  // Load rules and always include the RulesContextProvider
  const { rules, errors: rulesErrors } = await loadRules(ide);
  errors.push(...rulesErrors);
  newConfig.rules.unshift(...rules);

  // Convert invokable rules to slash commands
  for (const rule of newConfig.rules) {
    if (rule.invokable) {
      try {
        const slashCommand = convertRuleBlockToSlashCommand(rule);
        (newConfig.slashCommands ??= []).push(slashCommand);
      } catch (e) {
        errors.push({
          message: `Error converting invokable rule ${rule.name} to slash command: ${e instanceof Error ? e.message : e}`,
          fatal: false,
        });
      }
    }
  }

  newConfig.slashCommands.push(initSlashCommand);


  // Show deprecation warnings for providers
  const globalContext = new GlobalContext();
  newConfig.contextProviders.forEach((provider) => {
    if (provider.deprecationMessage) {
      const providerTitle = provider.description.title;
      const shownWarnings =
        globalContext.get("shownDeprecatedProviderWarnings") ?? {};
      if (!shownWarnings[providerTitle]) {
        void ide.showToast("warning", provider.deprecationMessage);
        globalContext.update("shownDeprecatedProviderWarnings", {
          ...shownWarnings,
          [providerTitle]: true,
        });
      }
    }
  });

  // Rectify model selections for each role
  newConfig = rectifySelectedModelsFromGlobalContext(newConfig, profileId);

  // Add things from MCP servers
  const mcpManager = MCPManagerSingleton.getInstance();
  const mcpServerStatuses = mcpManager.getStatuses();

  const serializableStatuses = mcpServerStatuses.map((server) => {
    const { client, ...rest } = server;
    return rest;
  });
  newConfig.mcpServerStatuses = serializableStatuses;

  for (const server of mcpServerStatuses) {
    server.errors.forEach((error) => {
      // MCP errors will also show as config loading errors
      errors.push({
        fatal: false,
        message: error,
      });
    });
    if (server.status === "connected") {
      const serverTools: Tool[] = server.tools.map((tool) => ({
        displayTitle: server.name + " " + tool.name,
        function: {
          description: tool.description,
          name: getMCPToolName(server, tool),
          parameters: tool.inputSchema,
        },
        faviconUrl: server.faviconUrl,
        readonly: false,
        type: "function" as const,
        uri: encodeMCPToolUri(server.id, tool.name),
        group: server.name,
        originalFunctionName: tool.name,
        mcpMeta: tool._meta,
      }));
      newConfig.tools.push(...serverTools);

      const serverSlashCommands = server.prompts.map((prompt) => ({
        name: prompt.name,
        description: prompt.description ?? "MCP Prompt",
        source: "mcp-prompt" as const,
        isLegacy: false,
        prompt: undefined,
        mcpServerName: server.name,
        mcpArgs: prompt.arguments,
      }));
      newConfig.slashCommands.push(...serverSlashCommands);

      const submenuItems = server.resources
        .map((resource) => ({
          title: resource.name,
          description: resource.description ?? resource.name,
          id: resource.uri,
          icon: server.faviconUrl,
        }))
        .concat(
          server.resourceTemplates.map((template) => ({
            title: template.name,
            description: template.description ?? template.name,
            id: template.uriTemplate,
            icon: server.faviconUrl,
          })),
        );
      if (submenuItems.length > 0) {
        const serverContextProvider = new MCPContextProvider({
          submenuItems,
          mcpId: server.id,
          serverName: server.name,
        });
        newConfig.contextProviders.push(serverContextProvider);
      }
    }
  }

  newConfig.tools.push(
    ...(await getConfigDependentToolDefinitions({
      rules: newConfig.rules,
      isSignedIn: false,
      modelName: newConfig.selectedModelByRole.chat?.model,
      ide,
      enableHeavyTools: false,
    })),
  );

  // Detect duplicate tool names
  const counts: Record<string, number> = {};
  newConfig.tools.forEach((tool) => {
    if (counts[tool.function.name]) {
      counts[tool.function.name] = counts[tool.function.name] + 1;
    } else {
      counts[tool.function.name] = 1;
    }
  });

  Object.entries(counts).forEach(([toolName, count]) => {
    if (count > 1) {
      errors!.push({
        fatal: false,
        message: `Duplicate (${count}) tools named "${toolName}" detected. Permissions will conflict and usage may be unpredictable`,
      });
    }
  });

  const ruleCounts: Record<string, number> = {};
  newConfig.rules.forEach((rule) => {
    if (rule.name) {
      if (ruleCounts[rule.name]) {
        ruleCounts[rule.name] = ruleCounts[rule.name] + 1;
      } else {
        ruleCounts[rule.name] = 1;
      }
    }
  });

  Object.entries(ruleCounts).forEach(([ruleName, count]) => {
    if (count > 1) {
      errors!.push({
        fatal: false,
        message: `Duplicate (${count}) rules named "${ruleName}" detected. This may cause unexpected behavior`,
      });
    }
  });

  return { config: newConfig, errors, configLoadInterrupted: false };
}
