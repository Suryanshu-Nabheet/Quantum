import { ILLM, LLMFullCompletionOptions } from "..";

import { removeCodeBlocksAndTrim, removeQuotesAndEscapes } from ".";

import type { FromCoreProtocol, ToCoreProtocol } from "../protocol";
import type { IMessenger } from "../protocol/messenger";
import { renderChatMessage } from "./messageContent";

export class ChatDescriber {
  static maxTokens = 16; // Increased from 12 to meet GPT-5 minimum requirement
  static prompt: string | undefined =
    "Given the following... please reply with a title for the chat that is 3-4 words in length, all words used should be directly related to the content of the chat, avoid using verbs unless they are directly related to the content of the chat, no additional text or explanation, you don't need ending punctuation.\n\n";
  static messenger: IMessenger<ToCoreProtocol, FromCoreProtocol>;

  static async describe(
    model: ILLM,
    completionOptions: LLMFullCompletionOptions,
    message: string,
  ): Promise<string | undefined> {
    if (!ChatDescriber.prompt) {
      return;
    }

    // Clean up and distill the message we want to send to the LLM
    message = removeCodeBlocksAndTrim(message);

    if (!message) {
      return;
    }

    completionOptions.maxTokens = ChatDescriber.maxTokens;

    // Prompt the user's current LLM for the title
    const titleResponse = await model.chat(
      [
        {
          role: "user",
          content: ChatDescriber.prompt + message,
        },
      ],
      new AbortController().signal,
      completionOptions,
    );

    // Set the title
    return removeQuotesAndEscapes(renderChatMessage(titleResponse));
  }
}
