import { fetchwithRequestOptions } from "fetch";
import { ChatMessage, IDE, PromptLog } from "..";
import { ConfigHandler } from "../config/ConfigHandler";
import { getReadResponseTTS } from "../config/uiPreferences";
import { FromCoreProtocol, ToCoreProtocol } from "../protocol";
import { IMessenger, Message } from "../protocol/messenger";

import { TTS } from "../util/tts";
import { renderChatMessage } from "../util/messageContent";
import {
  buildStreamContinuationMessages,
  MAX_STREAM_CHAT_CONTINUATIONS,
  mergeAssistantStreamChunk,
  shouldContinueLlmStream,
} from "./streamContinuation.js";

export async function* llmStreamChat(
  configHandler: ConfigHandler,
  abortController: AbortController,
  msg: Message<ToCoreProtocol["llm/streamChat"][0]>,
  ide: IDE,
  messenger: IMessenger<ToCoreProtocol, FromCoreProtocol>,
): AsyncGenerator<ChatMessage, PromptLog> {
  const { config } = await configHandler.loadConfig();
  if (!config) {
    throw new Error("Config not loaded");
  }

  // Stop TTS on new StreamChat
  if (getReadResponseTTS(config)) {
    void TTS.kill();
  }

  const {
    legacySlashCommandData,
    completionOptions,
    messages,
    messageOptions,
  } = msg.data;

  const model = config.selectedModelByRole.chat;

  if (!model) {
    throw new Error("No chat model selected");
  }

  // Log to return in case of error
  const errorPromptLog: PromptLog = {
    modelTitle: model?.title ?? model?.model,
    modelProvider: model?.underlyingProviderName ?? "unknown",
    completion: "",
    prompt: "",
  };

  try {
    if (legacySlashCommandData) {
      const { command, contextItems, historyIndex, input, selectedCode } =
        legacySlashCommandData;
      const slashCommand = config.slashCommands?.find(
        (sc) => sc.name === command.name,
      );
      if (!slashCommand) {
        throw new Error(`Unknown slash command ${command.name}`);
      }
      if (!slashCommand.run) {
        console.error(
          `Slash command ${command.name} (${command.source}) has no run function`,
        );
        throw new Error(`Slash command not found`);
      }

      const gen = slashCommand.run({
        input,
        history: messages,
        llm: model,
        contextItems,
        params: command.params,
        ide,
        addContextItem: (item) => {
          void messenger.request("addContextItem", {
            item,
            historyIndex,
          });
        },
        selectedCode,
        config,
        fetch: (url, init) =>
          fetchwithRequestOptions(
            url,
            {
              ...init,
              signal: abortController.signal,
            },
            model.requestOptions,
          ),
        completionOptions,
        abortController,
      });
      let next = await gen.next();
      while (!next.done) {
        if (abortController.signal.aborted) {
          next = await gen.return(errorPromptLog);
          break;
        }
        if (next.value) {
          yield {
            role: "assistant",
            content: next.value,
          };
        }
        next = await gen.next();
      }
      if (!next.done) {
        throw new Error("Will never happen");
      }

      return next.value;
    }

    let chatMessages = messages;
    let combinedPromptLog: PromptLog | undefined;
    let outputTokens = 0;
    let outputTokenCountIsEstimated = false;

    for (
      let continuation = 0;
      continuation <= MAX_STREAM_CHAT_CONTINUATIONS;
      continuation++
    ) {
      let partialAssistant: ChatMessage | undefined;
      const thinkingMessages: ChatMessage[] = [];
      const gen = model.streamChat(
        chatMessages,
        abortController.signal,
        completionOptions,
        messageOptions,
      );
      let next = await gen.next();
      while (!next.done) {
        if (abortController.signal.aborted) {
          next = await gen.return(errorPromptLog);
          break;
        }

        const chunk = next.value;
        if (chunk.role === "assistant") {
          partialAssistant = mergeAssistantStreamChunk(partialAssistant, chunk);
        } else if (chunk.role === "thinking") {
          thinkingMessages.push(chunk);
        }
        yield chunk;
        next = await gen.next();
      }

      if (!next.done) {
        throw new Error("Will never happen");
      }

      const segmentLog = next.value;
      const providerReportedOutputTokens =
        partialAssistant?.role === "assistant"
          ? partialAssistant.usage?.completionTokens
          : undefined;
      if (
        typeof providerReportedOutputTokens === "number" &&
        Number.isFinite(providerReportedOutputTokens) &&
        providerReportedOutputTokens >= 0
      ) {
        outputTokens += providerReportedOutputTokens;
      } else {
        outputTokenCountIsEstimated = true;
        const assistantMessage = partialAssistant
          ? renderChatMessage(partialAssistant)
          : segmentLog.completion;
        outputTokens += model.countTokens(assistantMessage);
        if (
          partialAssistant?.role === "assistant" &&
          partialAssistant.toolCalls?.length
        ) {
          outputTokens += model.countTokens(
            JSON.stringify(partialAssistant.toolCalls),
          );
        }
        for (const thinkingMessage of thinkingMessages) {
          outputTokens += model.countTokens(renderChatMessage(thinkingMessage));
        }
      }

      combinedPromptLog = combinedPromptLog
        ? {
            ...segmentLog,
            completion: combinedPromptLog.completion + segmentLog.completion,
          }
        : segmentLog;

      if (abortController.signal.aborted) {
        return combinedPromptLog;
      }

      if (
        continuation >= MAX_STREAM_CHAT_CONTINUATIONS ||
        !shouldContinueLlmStream(segmentLog, partialAssistant)
      ) {
        if (getReadResponseTTS(config) && combinedPromptLog.completion) {
          void TTS.read(combinedPromptLog.completion);
        }
        yield {
          role: "assistant",
          content: "",
          metadata: {
            contextOutputUsage: {
              tokens: outputTokens,
              estimated: outputTokenCountIsEstimated,
            },
          },
        };
        return combinedPromptLog;
      }

      chatMessages = buildStreamContinuationMessages(
        chatMessages,
        partialAssistant,
        segmentLog,
      );
    }

    return combinedPromptLog ?? errorPromptLog;
  } catch (error) {
    throw error;
  }
}
