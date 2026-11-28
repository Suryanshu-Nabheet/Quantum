import OpenAI from "./OpenAI";

import { LLMOptions, CompletionOptions, ChatMessage } from "../../index.js";
import { ChatCompletionCreateParams } from "openai/resources/index";

class Scaleway extends OpenAI {
  static providerName = "scaleway";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.scaleway.ai/v1/",
    useLegacyCompletionsEndpoint: false,
  };

  protected _convertArgs(
    options: CompletionOptions,
    messages: ChatMessage[],
  ): ChatCompletionCreateParams {
    return super._convertArgs(options, messages);
  }
}

export default Scaleway;
