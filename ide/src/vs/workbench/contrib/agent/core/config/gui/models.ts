import {
  mergeRequestOptions,
  ModelConfig,
} from "agent-config";

import { AgentConfig, ILLMLogger, LLMOptions } from "../..";
import { BaseLLM } from "../../llm";
import { getLLMClass } from "../../llm/llms";
import {
  AUTODETECT,
  catalogModelNamesForProvider,
  filterListedModelNames,
} from "./providerModelCatalog";

// Model discovery is optional enrichment. It must never hold the whole agent
// startup hostage when a local server is down or a remote endpoint is slow.
const MODEL_DISCOVERY_TIMEOUT_MS = 1_500;

async function modelConfigToBaseLLM({
  model,
  uniqueId,
  llmLogger,
  config,
  isFromAutoDetect,
}: {
  model: ModelConfig;
  uniqueId: string;
  llmLogger: ILLMLogger;
  config: AgentConfig;
  isFromAutoDetect?: boolean;
}): Promise<BaseLLM | undefined> {
  const cls = await getLLMClass(model.provider);

  if (!cls) {
    return undefined;
  }

  const { capabilities, ...rest } = model;

  const mergedRequestOptions = mergeRequestOptions(
    rest.requestOptions,
    config.requestOptions,
  );

  let options: LLMOptions = {
    ...rest,
    contextLength: model.defaultCompletionOptions?.contextLength,
    completionOptions: {
      ...(model.defaultCompletionOptions ?? {}),
      model: model.model,
      maxTokens:
        model.defaultCompletionOptions?.maxTokens ??
        cls.defaultOptions?.completionOptions?.maxTokens,
    },
    logger: llmLogger,
    uniqueId,
    title: model.name,
    template: model.promptTemplates?.chat,
    promptTemplates: model.promptTemplates,
    baseAgentSystemMessage: model.chatOptions?.baseAgentSystemMessage,
    basePlanSystemMessage: model.chatOptions?.basePlanSystemMessage,
    baseChatSystemMessage: model.chatOptions?.baseSystemMessage,
    toolOverrides: model.chatOptions?.toolOverrides
      ? Object.entries(model.chatOptions.toolOverrides).map(([name, o]) => ({
          name,
          ...o,
        }))
      : undefined,
    // Leave capabilities undefined unless explicitly listed so
    // modelSupportsImages / tool autodetection can still run.
    capabilities: undefined,
    autocompleteOptions: model.autocompleteOptions,
    isFromAutoDetect,
    requestOptions: mergedRequestOptions,
  };

  // Model capabilities - need to be undefined if not found
  // To fallback to our autodetection
  if (capabilities?.find((c) => c === "tool_use")) {
    options.capabilities = {
      ...options.capabilities,
      tools: true,
    };
  }

  if (capabilities?.find((c) => c === "image_input")) {
    options.capabilities = {
      ...options.capabilities,
      uploadImage: true,
    };
  }

  if (model.embedOptions?.maxBatchSize) {
    options.maxEmbeddingBatchSize = model.embedOptions.maxBatchSize;
  }
  if (model.embedOptions?.maxChunkSize) {
    options.maxEmbeddingChunkSize = model.embedOptions.maxChunkSize;
  }

  // These are params that are at model config level in JSON
  // But we decided to move to nested `env` in YAML
  // Since types vary and we don't want to blindly spread env for now,
  // Each one is handled individually here
  const env = model.env ?? {};
  if (
    "useLegacyCompletionsEndpoint" in env &&
    typeof env.useLegacyCompletionsEndpoint === "boolean"
  ) {
    options.useLegacyCompletionsEndpoint = env.useLegacyCompletionsEndpoint;
  }
  if ("apiType" in env && typeof env.apiType === "string") {
    options.apiType = env.apiType;
  }
  if ("apiVersion" in env && typeof env.apiVersion === "string") {
    options.apiVersion = env.apiVersion;
  }
  if ("deployment" in env && typeof env.deployment === "string") {
    options.deployment = env.deployment;
  }
  if ("deploymentId" in env && typeof env.deploymentId === "string") {
    options.deploymentId = env.deploymentId;
  }
  if ("projectId" in env && typeof env.projectId === "string") {
    options.projectId = env.projectId;
  }
  if ("region" in env && typeof env.region === "string") {
    options.region = env.region;
  }
  if ("profile" in env && typeof env.profile === "string") {
    options.profile = env.profile;
  }
  if ("accessKeyId" in env && typeof env.accessKeyId === "string") {
    options.accessKeyId = env.accessKeyId;
  }
  if ("secretAccessKey" in env && typeof env.secretAccessKey === "string") {
    options.secretAccessKey = env.secretAccessKey;
  }
  if ("modelArn" in env && typeof env.modelArn === "string") {
    options.modelArn = env.modelArn;
  }
  if ("accountId" in env && typeof env.accountId === "string") {
    options.accountId = env.accountId;
  }

  const llm = new cls(options);
  return llm;
}

async function expandModelNamesToLlms({
  modelNames,
  model,
  uniqueId,
  llmLogger,
  config,
}: {
  modelNames: string[];
  model: ModelConfig;
  uniqueId: string;
  llmLogger: ILLMLogger;
  config: AgentConfig;
}): Promise<BaseLLM[]> {
  const usedTitles = new Set<string>();
  const detectedModels = await Promise.all(
    modelNames.map(async (modelName) => {
      if (modelName === AUTODETECT) {
        return undefined;
      }
      let title = modelName;
      if (usedTitles.has(title)) {
        title = `${model.provider}/${modelName}`;
      }
      usedTitles.add(title);
      return await modelConfigToBaseLLM({
        model: {
          ...model,
          model: modelName,
          name: title,
        },
        uniqueId,
        llmLogger,
        config,
        isFromAutoDetect: true,
      });
    }),
  );
  return detectedModels.filter((x) => typeof x !== "undefined") as BaseLLM[];
}

async function autodetectModels({
  llm,
  model,
  uniqueId,
  llmLogger,
  config,
}: {
  llm: BaseLLM;
  model: ModelConfig;
  uniqueId: string;
  llmLogger: ILLMLogger;
  config: AgentConfig;
}): Promise<BaseLLM[]> {
  let modelNames: string[] = [];
  try {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error("Model discovery timed out")),
        MODEL_DISCOVERY_TIMEOUT_MS,
      );
    });
    try {
      modelNames = filterListedModelNames(
        model.provider,
        await Promise.race([llm.listModels(), timeout]),
      );
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  } catch (e) {
    // Keep configuration responsive. The catalog below still provides known
    // models, while an explicit model-list request can retry discovery later.
    console.debug("Model discovery unavailable: ", e);
  }

  if (modelNames.length === 0) {
    modelNames = catalogModelNamesForProvider(model.provider);
  }

  if (modelNames.length === 0) {
    return [];
  }

  return expandModelNamesToLlms({
    modelNames,
    model,
    uniqueId,
    llmLogger,
    config,
  });
}

export async function llmsFromModelConfig({
  model,
  uniqueId,
  llmLogger,
  config,
}: {
  model: ModelConfig;
  uniqueId: string;
  llmLogger: ILLMLogger;
  config: AgentConfig;
}): Promise<BaseLLM[]> {
  const baseLlm = await modelConfigToBaseLLM({
    model,
    uniqueId,
    llmLogger,
    config,
  });
  if (!baseLlm) {
    return [];
  }

  if (model.model === AUTODETECT) {
    const models = await autodetectModels({
      llm: baseLlm,
      model,
      uniqueId,
      llmLogger,
      config,
    });
    return models;
  } else {
    return [baseLlm];
  }
}
