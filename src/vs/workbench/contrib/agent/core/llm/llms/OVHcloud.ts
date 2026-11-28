import { ChatCompletionCreateParams } from "openai/resources/index";
import { ChatMessage, CompletionOptions, LLMOptions } from "../../index.js";
import OpenAI from "./OpenAI.js";

export class OVHcloud extends OpenAI {
  static providerName = "ovhcloud";

  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/",
    useLegacyCompletionsEndpoint: false,
  };

  protected _convertArgs(
    options: CompletionOptions,
    messages: ChatMessage[],
  ): ChatCompletionCreateParams {
    return super._convertArgs(options, messages);
  }
}

export default OVHcloud;
