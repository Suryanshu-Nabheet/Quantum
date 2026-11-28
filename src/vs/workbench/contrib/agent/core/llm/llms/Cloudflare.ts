import { streamSse } from "fetch";
import { ChatMessage, CompletionOptions } from "../../index.js";
import { renderChatMessage } from "../../util/messageContent.js";
import { BaseLLM } from "../index.js";

export default class Cloudflare extends BaseLLM {
  static providerName = "cloudflare";

  async listModels(): Promise<string[]> {
    if (!this.accountId) {
      throw new Error("Cloudflare account ID is required to list models.");
    }

    const models: string[] = [];
    for (let pageNumber = 1; ; pageNumber++) {
      const url = new URL(
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(this.accountId)}/ai/models/search`,
      );
      url.searchParams.set("task", "Text Generation");
      url.searchParams.set("page", String(pageNumber));
      url.searchParams.set("per_page", "100");
      const response = await this.fetch(url, {
        headers: {
          Authorization: `Bearer ${this.apiKey ?? ""}`,
          Accept: "application/json",
        },
      });
      const result = (await response.json()) as {
        result?: Array<{ name?: string; task?: string }>;
        result_info?: { total_pages?: number };
      };
      models.push(
        ...(result.result ?? []).flatMap((model) =>
          model.name ? [model.name] : [],
        ),
      );
      if (pageNumber >= (result.result_info?.total_pages ?? pageNumber)) {
        return models;
      }
    }
  }

  private _convertArgs(options: CompletionOptions) {
    const finalOptions = {
      max_tokens: options.maxTokens,
    };

    return finalOptions;
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage, any, unknown> {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      ...this.requestOptions?.headers,
    };
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/v1/chat/completions`;
    const resp = await this.fetch(new URL(url), {
      method: "POST",
      headers,
      body: JSON.stringify({
        messages,
        stream: true,
        model: this.model,
        ...this._convertArgs(options),
      }),
      signal,
    });

    for await (const value of streamSse(resp)) {
      if (value.choices?.[0]?.delta?.content) {
        yield {
          role: "assistant",
          content: value.choices[0].delta.content,
        };
      }
    }
  }

  protected async *_streamComplete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    for await (const chunk of this._streamChat(
      [{ role: "user", content: prompt }],
      signal,
      options,
    )) {
      yield renderChatMessage(chunk);
    }
  }
}
