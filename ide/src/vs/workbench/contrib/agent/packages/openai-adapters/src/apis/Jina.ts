import { OpenAI } from "openai/index";
import {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  Completion,
  CompletionCreateParamsNonStreaming,
  CompletionCreateParamsStreaming,
  Model,
} from "openai/resources/index";
import { JinaConfig } from "../types.js";
import { customFetch, rerank } from "../util.js";
import {
  BaseLlmApi,
  CreateRerankResponse,
  FimCreateParamsStreaming,
  RerankCreateParams,
} from "./base.js";

export class JinaApi implements BaseLlmApi {
  apiBase: string = "https://api.jina.ai/v1/";

  constructor(protected config: JinaConfig) {
    this.apiBase = config.apiBase ?? this.apiBase;
  }

  async chatCompletionNonStream(
    body: ChatCompletionCreateParamsNonStreaming,
  ): Promise<ChatCompletion> {
    throw new Error("Jina does not support chat completions.");
  }
  async *chatCompletionStream(
    body: ChatCompletionCreateParamsStreaming,
  ): AsyncGenerator<ChatCompletionChunk, any, unknown> {
    throw new Error("Jina does not support chat completions.");
  }
  async completionNonStream(
    body: CompletionCreateParamsNonStreaming,
  ): Promise<Completion> {
    throw new Error("Jina does not support text completions.");
  }
  async *completionStream(
    body: CompletionCreateParamsStreaming,
  ): AsyncGenerator<Completion, any, unknown> {
    throw new Error("Jina does not support text completions.");
  }
  async *fimStream(
    body: FimCreateParamsStreaming,
  ): AsyncGenerator<ChatCompletionChunk, any, unknown> {
    throw new Error("Jina does not support fill-in-the-middle completions.");
  }

  async embed(
    body: OpenAI.Embeddings.EmbeddingCreateParams,
  ): Promise<OpenAI.Embeddings.CreateEmbeddingResponse> {
    const endpoint = new URL("embeddings", this.apiBase);
    const inputs = Array.isArray(body.input) ? body.input : [body.input];
    const response = await customFetch(this.config.requestOptions)(endpoint, {
      method: "POST",
      body: JSON.stringify({ model: body.model, input: inputs }),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${this.config.apiKey ?? ""}`,
      },
    });
    const data = (await response.json()) as any;
    return {
      model: body.model,
      object: "list",
      data: (data.data ?? []).map((item: any) => ({
        object: "embedding",
        index: item.index,
        embedding: item.embedding,
      })),
      usage: {
        prompt_tokens: data.usage?.total_tokens ?? 0,
        total_tokens: data.usage?.total_tokens ?? 0,
      },
    };
  }

  async rerank(body: RerankCreateParams): Promise<CreateRerankResponse> {
    const endpoint = new URL("rerank", this.apiBase);
    const response = await customFetch(this.config.requestOptions)(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-api-key": this.config.apiKey ?? "",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
    });
    const data = (await response.json()) as any;

    return rerank({
      model: body.model,
      usage: {
        total_tokens: 0,
      },
      data: data.results.map((result: any) => result.relevance_score),
    });
  }

  list(): Promise<Model[]> {
    throw new Error("Jina does not support listing models.");
  }
}
