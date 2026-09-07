import { ModelRole } from "agent-config";

import {
    AgentConfig,
    BrowserSerializedAgentConfig,
    IDE,
    ILLM,
    ModelDescription,
} from "..";
import { serializeTool } from "../tools";
import { serializePromptTemplates } from "./util";

function llmToSerializedModelDescription(llm: ILLM): ModelDescription {
  return {
    provider: llm.providerName,
    underlyingProviderName: llm.underlyingProviderName,
    model: llm.model,
    title: llm.title ?? llm.model,
    apiKey: llm.apiKey,
    apiBase: llm.apiBase,
    contextLength: llm.contextLength,
    template: llm.template,
    completionOptions: llm.completionOptions,
    baseAgentSystemMessage: llm.baseAgentSystemMessage,
    basePlanSystemMessage: llm.basePlanSystemMessage,
    baseChatSystemMessage: llm.baseChatSystemMessage,
    requestOptions: llm.requestOptions,
    promptTemplates: serializePromptTemplates(llm.promptTemplates),
    capabilities: llm.capabilities,
    roles: llm.roles,
    configurationStatus: llm.getConfigurationStatus(),
    apiKeyLocation: llm.apiKeyLocation,
    envSecretLocations: llm.envSecretLocations,
    sourceFile: llm.sourceFile,
    isFromAutoDetect: llm.isFromAutoDetect,
    toolOverrides: llm.toolOverrides,
    // Provider-specific env fields — needed so Configure can prefill Azure etc.
    deployment: llm.deployment,
    apiVersion: llm.apiVersion,
    apiType:
      llm.apiType === "azure" || llm.apiType === "openai"
        ? llm.apiType
        : undefined,
    deploymentId: llm.deploymentId,
    projectId: llm.projectId,
    region: llm.region,
    profile: llm.profile,
    accountId: llm.accountId,
  };
}

export async function finalToBrowserConfig(
  final: AgentConfig,
  _ide: IDE,
): Promise<BrowserSerializedAgentConfig> {
  const deduplicateModels = (
    models: ModelDescription[],
  ): ModelDescription[] => {
    const seen = new Set<string>();
    const deduped: ModelDescription[] = [];

    for (const model of models) {
      const providerKey = (model.provider ?? "").trim().toLowerCase();
      const modelKey = (model.model ?? "").trim().toLowerCase();
      const titleKey = (model.title ?? "").trim().toLowerCase();
      const key = modelKey
        ? `${providerKey}::${modelKey}`
        : `${providerKey}::title:${titleKey}`;

      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      deduped.push(model);
    }

    return deduped;
  };

  return {
    completionOptions: final.completionOptions,
    slashCommands: final.slashCommands?.map(({ run, ...rest }) => ({
      ...rest,
      isLegacy: !!run,
    })),
    contextProviders: final.contextProviders?.map((c) => c.description),
    disableSessionTitles: final.disableSessionTitles,
    tabAutocompleteOptions: final.tabAutocompleteOptions,
    ui: final.ui,
    experimental: final.experimental,
    rules: final.rules,
    tools: final.tools.map(serializeTool),
    mcpServerStatuses: final.mcpServerStatuses,
    modelsByRole: Object.fromEntries(
      Object.entries(final.modelsByRole).map(([k, v]) => [
        k,
        deduplicateModels(v.map(llmToSerializedModelDescription)),
      ]),
    ) as Record<ModelRole, ModelDescription[]>,
    selectedModelByRole: Object.fromEntries(
      Object.entries(final.selectedModelByRole).map(([k, v]) => [
        k,
        v ? llmToSerializedModelDescription(v) : null,
      ]),
    ) as Record<ModelRole, ModelDescription | null>,
  };
}
