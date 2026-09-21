import Handlebars from "handlebars";
import {
  BaseCompletionOptions,
  IdeSettings,
  ILLM,
  ILLMLogger,
  JSONModelDescription,
  LLMOptions,
} from "../..";
import { renderTemplatedString } from "../../util/handlebars/renderTemplatedString";
import { BaseLLM } from "../index";

type LLMClass = {
  providerName: string;
  defaultOptions?: Partial<LLMOptions>;
  new (options: LLMOptions): BaseLLM;
};
type ProviderLoader = () => Promise<LLMClass>;

const providerLoaders: Record<string, ProviderLoader> = {
  anthropic: async () => (await import("./Anthropic")).default,
  asksage: async () => (await import("./Asksage")).default,
  azure: async () => (await import("./Azure")).default,
  bedrock: async () => (await import("./Bedrock")).default,
  bedrockimport: async () => (await import("./BedrockImport")).default,
  cerebras: async () => (await import("./Cerebras")).default,
  cloudflare: async () => (await import("./Cloudflare")).default,
  cohere: async () => (await import("./Cohere")).default,
  cometapi: async () => (await import("./CometAPI")).default,
  deepinfra: async () => (await import("./DeepInfra")).default,
  deepseek: async () => (await import("./Deepseek")).default,
  docker: async () => (await import("./Docker")).default,
  fireworks: async () => (await import("./Fireworks")).default,
  "function-network": async () => (await import("./FunctionNetwork")).default,
  gemini: async () => (await import("./Gemini")).default,
  groq: async () => (await import("./Groq")).default,
  "huggingface-inference-api": async () => (await import("./HuggingFaceInferenceAPI")).default,
  "huggingface-tei": async () => (await import("./HuggingFaceTEI")).default,
  "huggingface-tgi": async () => (await import("./HuggingFaceTGI")).default,
  inception: async () => (await import("./Inception")).default,
  kindo: async () => (await import("./Kindo")).default,
  "llama.cpp": async () => (await import("./LlamaCpp")).default,
  llamafile: async () => (await import("./Llamafile")).default,
  llamastack: async () => (await import("./LlamaStack")).default,
  lemonade: async () => (await import("./Lemonade")).default,
  lmstudio: async () => (await import("./LMStudio")).default,
  mistral: async () => (await import("./Mistral")).default,
  mimo: async () => (await import("./Mimo")).default,
  mock: async () => (await import("./Mock")).default,
  moonshot: async () => (await import("./Moonshot")).default,
  msty: async () => (await import("./Msty")).default,
  ncompass: async () => (await import("./NCompass")).default,
  nebius: async () => (await import("./Nebius")).default,
  nous: async () => (await import("./Nous")).default,
  novita: async () => (await import("./Novita")).default,
  nvidia: async () => (await import("./Nvidia")).default,
  ollama: async () => (await import("./Ollama")).default,
  openai: async () => (await import("./OpenAI")).default,
  openrouter: async () => (await import("./OpenRouter")).default,
  ovhcloud: async () => (await import("./OVHcloud")).default,
  relace: async () => (await import("./Relace")).Relace,
  sagemaker: async () => (await import("./SageMaker")).default,
  sambanova: async () => (await import("./SambaNova")).default,
  scaleway: async () => (await import("./Scaleway")).default,
  siliconflow: async () => (await import("./SiliconFlow")).default,
  tensorix: async () => (await import("./Tensorix")).default,
  tars: async () => (await import("./TARS")).default,
  test: async () => (await import("./Test")).default,
  "text-gen-webui": async () => (await import("./TextGenWebUI")).default,
  together: async () => (await import("./Together")).default,
  venice: async () => (await import("./Venice")).default,
  vertexai: async () => (await import("./VertexAI")).default,
  vllm: async () => (await import("./Vllm")).default,
  voyage: async () => (await import("./Voyage")).default,
  watsonx: async () => (await import("./WatsonX")).default,
  xai: async () => (await import("./xAI")).default,
  zai: async () => (await import("./zAI")).default,
};

const loadedProviders = new Map<string, Promise<LLMClass | undefined>>();

export async function getLLMClass(providerName: string): Promise<LLMClass | undefined> {
  const key = providerName.toLowerCase();
  let loader = loadedProviders.get(key);
  if (!loader) {
    const load = providerLoaders[key];
    loader = load ? load() : Promise.resolve(undefined);
    loadedProviders.set(key, loader);
  }
  return loader;
}

// Kept for consumers that explicitly need the complete provider inventory.
export { LLMClasses } from "./all";

export async function llmFromDescription(
  desc: JSONModelDescription,
  readFile: (filepath: string) => Promise<string>,
  getUriFromPath: (path: string) => Promise<string | undefined>,
  uniqueId: string,
  ideSettings: IdeSettings,
  llmLogger: ILLMLogger,
  completionOptions?: BaseCompletionOptions,
): Promise<BaseLLM | undefined> {
  const cls = await getLLMClass(desc.provider);

  if (!cls) {
    return undefined;
  }

  const finalCompletionOptions = {
    ...completionOptions,
    ...desc.completionOptions,
  };

  let baseChatSystemMessage: string | undefined = undefined;
  if (desc.systemMessage !== undefined) {
    // baseChatSystemMessage = DEFAULT_CHAT_SYSTEM_MESSAGE;
    // baseChatSystemMessage += "\n\n";
    baseChatSystemMessage = await renderTemplatedString(
      Handlebars,
      desc.systemMessage,
      {},
      [],
      readFile,
      getUriFromPath,
    );
  }

  let options: LLMOptions = {
    ...desc,
    completionOptions: {
      ...finalCompletionOptions,
      model: (desc.model || cls.defaultOptions?.model) ?? "codellama-7b",
      maxTokens:
        finalCompletionOptions.maxTokens ??
        cls.defaultOptions?.completionOptions?.maxTokens,
    },
    baseChatSystemMessage,
    basePlanSystemMessage: baseChatSystemMessage,
    baseAgentSystemMessage: baseChatSystemMessage,
    logger: llmLogger,
    uniqueId,
  };


  return new cls(options);
}

export async function llmFromProviderAndOptions(
  providerName: string,
  llmOptions: LLMOptions,
): Promise<ILLM> {
  const cls = await getLLMClass(providerName);

  if (!cls) {
    throw new Error(`Unknown LLM provider type "${providerName}"`);
  }

  return new cls(llmOptions);
}
