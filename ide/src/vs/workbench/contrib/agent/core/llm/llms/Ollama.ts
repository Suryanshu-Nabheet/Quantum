import { Mutex } from "async-mutex";
import { JSONSchema7, JSONSchema7Object } from "json-schema";
import { v4 as uuidv4 } from "uuid";

import { streamResponse } from "fetch";
import {
  ChatMessage,
  ChatMessageRole,
  CompletionOptions,
  LLMOptions,
  ModelInstaller,
  ThinkingChatMessage,
} from "../../index.js";
import { renderChatMessage } from "../../util/messageContent.js";
import {
  isOllamaCloudModelName,
  isOllamaModelKnownNonFim,
  OllamaModelTag,
  sortOllamaModelTagsLocalFirst,
} from "../../util/ollamaHelper.js";
import { extractBase64FromDataUrl } from "../../util/url.js";
import { BaseLLM } from "../index.js";

type OllamaChatMessage = {
  role: ChatMessageRole;
  content: string;
  images?: string[] | null;
  thinking?: string;
  tool_name?: string;
  tool_calls?: {
    function: {
      name: string;
      arguments: JSONSchema7Object;
    };
  }[];
};

// See https://github.com/ollama/ollama/blob/main/docs/modelfile.md for details on each parameter
interface OllamaModelFileParams {
  mirostat?: number;
  mirostat_eta?: number;
  mirostat_tau?: number;
  num_ctx?: number;
  repeat_last_n?: number;
  repeat_penalty?: number;
  temperature?: number;
  seed?: number;
  stop?: string | string[];
  tfs_z?: number;
  num_predict?: number;
  top_k?: number;
  top_p?: number;
  min_p?: number;
  num_gpu?: number;

  // Deprecated or not directly supported here:
  num_thread?: number;
  use_mmap?: boolean;
  num_gqa?: number;
  num_keep?: number;
  typical_p?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  penalize_newline?: boolean;
  numa?: boolean;
  num_batch?: number;
  main_gpu?: number;
  low_vram?: boolean;
  vocab_only?: boolean;
  use_mlock?: boolean;
}

// See https://github.com/ollama/ollama/blob/main/docs/api.md
interface OllamaBaseOptions {
  model: string; // the model name
  options?: OllamaModelFileParams; // additional model parameters listed in the documentation for the Modelfile such as temperature
  format?: "json"; // the format to return a response in. Currently, the only accepted value is json
  stream?: boolean; // if false the response will be returned as a single response object, rather than a stream of objects
  keep_alive?: number; // controls how long the model will stay loaded into memory following the request (default: 5m)
}

interface OllamaRawOptions extends OllamaBaseOptions {
  prompt: string; // the prompt to generate a response for
  suffix?: string; // the text after the model response
  images?: string[]; // a list of base64-encoded images (for multimodal models such as llava)
  system?: string; // system message to (overrides what is defined in the Modelfile)
  template?: string; // the prompt template to use (overrides what is defined in the Modelfile)
  context?: string; // the context parameter returned from a previous request to /generate, this can be used to keep a short conversational memory
  raw?: boolean; // if true no formatting will be applied to the prompt. You may choose to use the raw parameter if you are specifying a full templated prompt in your request to the API
}

interface OllamaChatOptions extends OllamaBaseOptions {
  messages: OllamaChatMessage[]; // the messages of the chat, this can be used to keep a chat memory
  tools?: OllamaTool[];
  think?: boolean;
}

type OllamaBaseResponse = {
  model: string;
  created_at: string;
} & (
  | {
      done: false;
    }
  | {
      done: true;
      done_reason: string;
      total_duration: number; // Time spent generating the response in nanoseconds
      load_duration: number; // Time spent loading the model in nanoseconds
      prompt_eval_count: number; // Number of tokens in the prompt
      prompt_eval_duration: number; // Time spent evaluating the prompt in nanoseconds
      eval_count: number; // Number of tokens in the response
      eval_duration: number; // Time spent generating the response in nanoseconds
      context: number[]; // An encoding of the conversation used in this response; can be sent in the next request to keep conversational memory
    }
);

type OllamaErrorResponse = {
  error: string;
};

type N8nChatReponse = {
  type: string;
  content?: string;
  metadata: {
    nodeId: string;
    nodeName: string;
    itemIndex: number;
    runIndex: number;
    timestamps: number;
  };
};

type OllamaRawResponse =
  | OllamaErrorResponse
  | (OllamaBaseResponse & {
      response: string; // the generated response
    });

type OllamaChatResponse =
  | OllamaErrorResponse
  | (OllamaBaseResponse & {
      message: OllamaChatMessage;
    })
  | N8nChatReponse;

interface OllamaTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: JSONSchema7;
  };
}

function parseOllamaToolArguments(raw: string | undefined): JSONSchema7Object {
  if (!raw?.trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as JSONSchema7Object;
    }
  } catch {
    // Ollama requires an object. A broken argument string cannot be replayed.
  }
  return {};
}

function resolveOllamaToolName(
  messages: ChatMessage[],
  index: number,
): string | undefined {
  const current = messages[index];
  if (current.role !== "tool") {
    return undefined;
  }
  for (let i = index - 1; i >= 0; i--) {
    const previous = messages[i];
    if (previous.role !== "assistant" || !previous.toolCalls?.length) {
      if (previous.role === "user" || previous.role === "system") {
        break;
      }
      continue;
    }
    const byId = previous.toolCalls.find(
      (call) => call.id && call.id === current.toolCallId,
    );
    if (byId?.function?.name) {
      return byId.function.name;
    }
    const slot = messages
      .slice(i + 1, index + 1)
      .filter((message) => message.role === "tool")
      .indexOf(current);
    return previous.toolCalls[slot]?.function?.name;
  }
  return undefined;
}

function toOllamaChatMessage(message: ChatMessage): OllamaChatMessage {
  const ollamaMessage: OllamaChatMessage = {
    role: message.role,
    content: renderChatMessage(message),
  };
  if (Array.isArray(message.content)) {
    const images: string[] = [];
    message.content.forEach((part) => {
      if (part.type === "imageUrl" && part.imageUrl) {
        const image = part.imageUrl?.url
          ? extractBase64FromDataUrl(part.imageUrl.url)
          : undefined;
        if (image) {
          images.push(image);
        }
      }
    });
    if (images.length > 0) {
      ollamaMessage.images = images;
    }
  }
  return ollamaMessage;
}

/** Ollama only accepts system, user, assistant, and tool. Thinking is not a role. */
export function convertToOllamaMessages(
  messages: ChatMessage[],
): OllamaChatMessage[] {
  const converted: OllamaChatMessage[] = [];
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (message.role === "thinking") {
      continue;
    }
    if (message.role === "tool") {
      const toolName = resolveOllamaToolName(messages, i);
      converted.push({
        role: "tool",
        content: message.content,
        ...(toolName ? { tool_name: toolName } : {}),
      });
      continue;
    }
    if (message.role === "assistant") {
      const ollamaMessage = toOllamaChatMessage(message);
      const calls =
        message.toolCalls?.filter((call) => call.function?.name) ?? [];
      if (calls.length) {
        ollamaMessage.tool_calls = calls.map((call) => ({
          function: {
            name: call.function!.name!,
            arguments: parseOllamaToolArguments(call.function?.arguments),
          },
        }));
      }
      converted.push(ollamaMessage);
      continue;
    }
    converted.push(toOllamaChatMessage(message));
  }
  return converted;
}

export function ollamaNdjsonLines(buffer: string): { lines: string[]; rest: string } {
  const parts = buffer.split("\n");
  const rest = parts.pop() ?? "";
  return {
    lines: parts.map((line) => line.trim()).filter((line) => line.length > 0),
    rest,
  };
}

class Ollama extends BaseLLM implements ModelInstaller {
  static providerName = "ollama";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "http://localhost:11434/",
    model: "AUTODETECT",
    maxEmbeddingBatchSize: 64,
  };

  private static modelsBeingInstalled: Set<string> = new Set();
  private static modelsBeingInstalledMutex = new Mutex();

  private fimSupported: boolean = false;
  /** False until /api/show returns — avoids insert-mode 400s on non-FIM models. */
  private fimShowResolved: boolean = false;
  private readonly fimCheckPromise: Promise<void>;
  constructor(options: LLMOptions) {
    const apiKey =
      options.apiKey?.trim() || process.env.OLLAMA_API_KEY?.trim() || undefined;
    super({ ...options, apiKey });

    if (options.model === "AUTODETECT") {
      this.fimCheckPromise = Promise.resolve();
      return;
    }
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    this.fimCheckPromise = this.fetch(this.getEndpoint("api/show"), {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ name: this._getModel() }),
    })
      .then(async (response) => {
        if (response?.status !== 200) {
          this.fimShowResolved = true;
          return;
        }
        const body = await response.json();
        if (body.parameters) {
          const params = [];
          for (const line of body.parameters.split("\n")) {
            let parts = line.match(/^(\S+)\s+((?:".*")|\S+)$/);
            if (parts.length < 2) {
              continue;
            }
            let key = parts[1];
            let value = parts[2];
            switch (key) {
              case "num_ctx":
                this._contextLength =
                  options.contextLength ?? Number.parseInt(value);
                break;
              case "stop":
                if (!this.completionOptions.stop) {
                  this.completionOptions.stop = [];
                }
                try {
                  this.completionOptions.stop.push(JSON.parse(value));
                } catch (e) {
                  console.warn(
                    `Error parsing stop parameter value "{value}: ${e}`,
                  );
                }
                break;
              default:
                break;
            }
          }
        }

        /**
         * There is no API to get the model's FIM capabilities, so we have to
         * make an educated guess. If a ".Suffix" variable appears in the template
         * it's a good indication the model supports FIM.
         */
        this.fimSupported =
          !isOllamaModelKnownNonFim(this._getModel()) &&
          (!!body?.template?.includes(".Suffix") ||
            isOllamaCloudModelName(this._getModel()));
        this.fimShowResolved = true;
      })
      .catch(() => {
        this.fimShowResolved = true;
      });
  }

  async waitForFimCapabilityCheck(): Promise<void> {
    await this.fimCheckPromise;
  }

  private _getModel() {
    return this.model;
  }

  get contextLength() {
    // qwen3.5 is a 256k model. An 8k window fills on a tool turn and the
    // reply stops as soon as the context is full.
    const DEFAULT_OLLAMA_CONTEXT_LENGTH = 32_768;
    return this._contextLength ?? DEFAULT_OLLAMA_CONTEXT_LENGTH;
  }

  private _getModelFileParams(
    options: CompletionOptions,
  ): OllamaModelFileParams {
    return {
      temperature: options.temperature,
      top_p: options.topP,
      top_k: options.topK,
      num_predict: options.maxTokens,
      stop: options.stop,
      num_ctx: this.contextLength,
      mirostat: options.mirostat,
      num_thread: options.numThreads,
      use_mmap: options.useMmap,
      min_p: options.minP,
      num_gpu: options.numGpu,
    };
  }

  private _getGenerateOptions(
    options: CompletionOptions,
    prompt: string,
    suffix?: string,
  ): OllamaRawOptions {
    return {
      model: this._getModel(),
      prompt,
      suffix,
      raw: options.raw,
      options: this._getModelFileParams(options),
      keep_alive: options.keepAlive ?? 60 * 30, // 30 minutes
      stream: options.stream,
      // Not supported yet: context, images, system, template, format
    };
  }

  private getEndpoint(endpoint: string): URL {
    let base = this.apiBase;
    if (base?.endsWith("/v1/")) {
      base = base.replace(/\/v1\/$/, "/");
    } else if (base?.endsWith("/v1")) {
      base = base.replace(/\/v1$/, "/");
    }

    return new URL(endpoint, base);
  }

  protected async *_streamComplete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }
    const response = await this.fetch(this.getEndpoint("api/generate"), {
      method: "POST",
      headers: headers,
      body: JSON.stringify(this._getGenerateOptions(options, prompt)),
      signal,
    });

    let buffer = "";
    for await (const value of streamResponse(response)) {
      // Append the received chunk to the buffer
      buffer += value;
      // Split the buffer into individual JSON chunks
      const chunks = buffer.split("\n");
      buffer = chunks.pop() ?? "";

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (chunk.trim() !== "") {
          try {
            const j = JSON.parse(chunk) as OllamaRawResponse;
            if ("error" in j) {
              throw new Error(j.error);
            }
            j.response ??= "";
            yield j.response;
          } catch (e) {
            throw new Error(`Error parsing Ollama response: ${e} ${chunk}`);
          }
        }
      }
    }
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const ollamaMessages = convertToOllamaMessages(messages);
    const chatOptions: OllamaChatOptions = {
      model: this._getModel(),
      messages: ollamaMessages,
      options: this._getModelFileParams(options),
      // Thinking models spend the turn in thought and never emit tool calls.
      // Keep thinking only when the user turned it on and this request has no tools.
      think: options.tools?.length ? false : options.reasoning,
      keep_alive: options.keepAlive ?? 60 * 30, // 30 minutes
      stream: options.stream,
    };
    if (options.tools?.length) {
      chatOptions.tools = options.tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters,
        },
      }));
    }
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }
    const response = await this.fetch(this.getEndpoint("api/chat"), {
      method: "POST",
      headers: headers,
      body: JSON.stringify(chatOptions),
      signal,
    });
    let isThinking: boolean = false;

    function convertChatMessage(res: OllamaChatResponse): ChatMessage[] {
      if ("error" in res) {
        throw new Error(res.error);
      }

      if ("type" in res) {
        const { content } = res;

        if (content === "<think>") {
          isThinking = true;
        }

        if (isThinking && content) {
          const thinkingMessage: ThinkingChatMessage = {
            role: "thinking",
            content: content,
          };

          if (thinkingMessage) {
            // could cause issues with termination if chunk doesn't match this exactly
            if (content === "</think>") {
              isThinking = false;
            }
            // When Streaming you can't have both thinking and content
            return [thinkingMessage];
          }
        }

        if (content) {
          const chatMessage: ChatMessage = {
            role: "assistant",
            content: content,
          };
          return [chatMessage];
        }
        return [];
      }

      const { role, content, thinking, tool_calls: toolCalls } = res.message;

      if (role === "tool") {
        throw new Error(
          "Unexpected message received from Ollama with role = tool",
        );
      }

      if (role === "assistant") {
        const thinkingMessage: ThinkingChatMessage | null = thinking
          ? { role: "thinking", content: thinking }
          : null;

        if (thinkingMessage && !content && !toolCalls?.length) {
          return [thinkingMessage];
        }

        const chatMessage: ChatMessage = { role: "assistant", content: content ?? "" };

        if (toolCalls?.length) {
          // Agent handles the response as a tool call delta but
          // But ollama returns the full object in one response with no streaming
          chatMessage.toolCalls = toolCalls.map((tc) => ({
            type: "function",
            id: `tc_${uuidv4()}`, // Generate a proper UUID with a prefix
            function: {
              name: tc.function.name,
              arguments: JSON.stringify(tc.function.arguments),
            },
          }));
        }

        // Return both thinking and chat messages if applicable
        return thinkingMessage ? [thinkingMessage, chatMessage] : [chatMessage];
      }

      // Fallback for all other roles
      return [{ role, content }];
    }

    if (chatOptions.stream === false) {
      if (response.status === 499) {
        return; // Aborted by user
      }
      const json = (await response.json()) as OllamaChatResponse;
      if ("done" in json && json.done && "done_reason" in json && json.done_reason) {
        this.lastStreamFinishReason = json.done_reason;
      }
      for (const msg of convertChatMessage(json)) {
        yield msg;
      }
    } else {
      let buffer = "";
      const yieldChatChunk = (chunk: string) => {
        const parsed = JSON.parse(chunk) as OllamaChatResponse;
        if ("done" in parsed && parsed.done && "done_reason" in parsed && parsed.done_reason) {
          this.lastStreamFinishReason = parsed.done_reason;
        }
        return convertChatMessage(parsed);
      };
      for await (const value of streamResponse(response)) {
        buffer += value;
        const split = ollamaNdjsonLines(buffer);
        buffer = split.rest;

        for (const chunk of split.lines) {
          try {
            for (const msg of yieldChatChunk(chunk)) {
              yield msg;
            }
          } catch (e) {
            throw new Error(`Error parsing Ollama response: ${e} ${chunk}`);
          }
        }
      }
      const tail = buffer.trim();
      if (tail) {
        for (const msg of yieldChatChunk(tail)) {
          yield msg;
        }
      }
    }
  }

  supportsFim(): boolean {
    if (isOllamaCloudModelName(this._getModel())) {
      return true;
    }
    if (isOllamaModelKnownNonFim(this._getModel())) {
      return false;
    }
    if (!this.fimShowResolved) {
      return false;
    }
    return this.fimSupported;
  }

  protected async *_streamFim(
    prefix: string,
    suffix: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }
    const response = await this.fetch(this.getEndpoint("api/generate"), {
      method: "POST",
      headers: headers,
      body: JSON.stringify(this._getGenerateOptions(options, prefix, suffix)),
      signal,
    });

    let buffer = "";
    for await (const value of streamResponse(response)) {
      // Append the received chunk to the buffer
      buffer += value;
      // Split the buffer into individual JSON chunks
      const chunks = buffer.split("\n");
      buffer = chunks.pop() ?? "";

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (chunk.trim() !== "") {
          try {
            const j = JSON.parse(chunk);
            if ("response" in j) {
              yield j.response;
            } else if ("error" in j) {
              this.fimSupported = false;
              throw new Error(j.error);
            }
          } catch (e) {
            throw new Error(`Error parsing Ollama response: ${e} ${chunk}`);
          }
        }
      }
    }
  }

  private async fetchModelTags(signal?: AbortSignal): Promise<OllamaModelTag[]> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    const response = await this.fetch(
      // localhost was causing fetch failed in pkg binary only for this Ollama endpoint
      this.getEndpoint("api/tags"),
      {
        method: "GET",
        headers: headers,
        signal,
      },
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(
        "Failed to list Ollama models. Make sure Ollama is running.",
      );
    }

    return (data.models ?? []) as OllamaModelTag[];
  }

  async listModels(signal?: AbortSignal): Promise<string[]> {
    const tags = sortOllamaModelTagsLocalFirst(await this.fetchModelTags(signal));
    return tags.map((tag) => tag.name);
  }

  protected async _embed(chunks: string[]): Promise<number[][]> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }
    const resp = await this.fetch(new URL("api/embed", this.apiBase), {
      method: "POST",
      body: JSON.stringify({
        model: this.model,
        input: chunks,
      }),
      headers: headers,
    });

    if (!resp.ok) {
      throw new Error(`Failed to embed chunk: ${await resp.text()}`);
    }

    const data = await resp.json();
    const embedding: number[][] = data.embeddings;

    if (!embedding || embedding.length === 0) {
      throw new Error("Ollama generated empty embedding");
    }
    return embedding;
  }

  public async installModel(
    modelName: string,
    signal: AbortSignal,
    progressReporter?: (task: string, increment: number, total: number) => void,
  ): Promise<any> {

    const release = await Ollama.modelsBeingInstalledMutex.acquire();
    try {
      if (Ollama.modelsBeingInstalled.has(modelName)) {
        throw new Error(`Model '${modelName}' is already being installed.`);
      }
      Ollama.modelsBeingInstalled.add(modelName);
    } finally {
      release();
    }

    try {
      const response = await fetch(this.getEndpoint("api/pull"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ name: modelName }),
        signal,
      });

      const reader = response.body?.getReader();
      while (true) {
        const { done, value } = (await reader?.read()) || {
          done: true,
          value: undefined,
        };
        if (done) {
          break;
        }

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split("\n").filter(Boolean);
        for (const line of lines) {
          const data = JSON.parse(line);
          progressReporter?.(data.status, data.completed, data.total);
        }
      }
    } finally {
      const release = await Ollama.modelsBeingInstalledMutex.acquire();
      try {
        Ollama.modelsBeingInstalled.delete(modelName);
      } finally {
        release();
      }
    }
  }

  public async isInstallingModel(modelName: string): Promise<boolean> {
    const release = await Ollama.modelsBeingInstalledMutex.acquire();
    try {
      return Ollama.modelsBeingInstalled.has(modelName);
    } finally {
      release();
    }
  }
}

export default Ollama;
