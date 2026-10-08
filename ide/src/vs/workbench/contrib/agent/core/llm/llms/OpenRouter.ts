import { ChatCompletionCreateParams } from "openai/resources/index";
import { applyAnthropicCachingToOpenRouterBody } from "openai-adapters";

import { LLMOptions } from "../../index.js";
import { osModelsEditPrompt } from "../templates/edit.js";

import OpenAI from "./OpenAI.js";

class OpenRouter extends OpenAI {
  static providerName = "openrouter";
  protected supportsReasoningField = true;
  protected supportsReasoningDetailsField = true;
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://openrouter.ai/api/v1/",
    model: "gpt-4o-mini",
    promptTemplates: {
      edit: osModelsEditPrompt,
    },
    useLegacyCompletionsEndpoint: false,
  };

  /**
   * Detect if the model is an Anthropic/Claude model
   */
  private isAnthropicModel(model?: string): boolean {
    if (!model) return false;
    const modelLower = model.toLowerCase();
    return modelLower.includes("claude");
  }

  /**
   * Apply Anthropic prompt caching to Claude models. Strategy selection and
   * breakpoint budgeting live in openai-adapters so core and the adapter
   * request path share one implementation.
   */
  protected modifyChatBody(
    body: ChatCompletionCreateParams,
  ): ChatCompletionCreateParams {
    body = super.modifyChatBody(body);

    const shouldCache =
      this.cacheBehavior?.cacheConversation ||
      this.cacheBehavior?.cacheSystemMessage ||
      this.completionOptions.promptCaching;

    if (!this.isAnthropicModel(body.model) || !shouldCache) {
      return body;
    }

    applyAnthropicCachingToOpenRouterBody(body, "systemAndTools");
    return body;
  }
}

export default OpenRouter;
