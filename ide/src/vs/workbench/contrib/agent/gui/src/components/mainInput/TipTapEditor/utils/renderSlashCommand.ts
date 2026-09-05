import { MessagePart, RangeInFile, SlashCommandDescWithSource } from "core";
import { stripImages } from "core/util/messageContent";
import { IIdeMessenger } from "../../../../context/IdeMessenger";
import { renderMcpPrompt } from "./renderMcpPrompt";
import { getRenderedV1Prompt } from "./renderPromptv1";
import { getPromptV2ContextRequests } from "./renderPromptv2";
import { GetContextRequest } from "./types";

/**
 * Render a slash command into message parts based on its source.
 * Active sources: built-in, quantum-settings-prompt, invokable-rule, mcp-prompt.
 */
export async function renderSlashCommandPrompt(
  ideMessenger: IIdeMessenger,
  commandName: string | undefined,
  parts: MessagePart[],
  availableSlashCommands: SlashCommandDescWithSource[],
  selectedCode: RangeInFile[],
): Promise<{
  slashedParts: MessagePart[];
  legacyCommandWithInput?: {
    command: SlashCommandDescWithSource;
    input: string;
  };
  contextRequests: GetContextRequest[];
}> {
  const NO_COMMAND = {
    slashedParts: parts,
    legacyCommandWithInput: undefined,
    contextRequests: [],
  };
  if (!commandName) {
    return NO_COMMAND;
  }
  const command = availableSlashCommands.find((c) => c.name === commandName);
  if (!command) {
    return NO_COMMAND;
  }

  const nonTextParts = parts.filter((part) => part.type !== "text");
  const textParts = parts.filter((part) => part.type === "text");
  const slashedParts: MessagePart[] = [...nonTextParts];

  const userInput = stripImages(textParts).trimStart();

  const legacyCommandWithInput = command.isLegacy
    ? {
        command,
        input: userInput,
      }
    : undefined;

  const contextRequests: GetContextRequest[] = [];

  switch (command.source) {
    case "mcp-prompt": {
      const renderedMcpPrompt = await renderMcpPrompt(
        command,
        ideMessenger,
        userInput,
      );
      slashedParts.push({
        type: "text",
        text: renderedMcpPrompt,
      });
      break;
    }
    case "quantum-settings-prompt":
    case "invokable-rule": {
      if (!command.prompt) {
        console.warn(`Invalid/empty prompt from slash command ${command.name}`);
        break;
      }
      let renderedPrompt: string;
      if (command.prompt.includes("{{{ input }}}")) {
        renderedPrompt = await getRenderedV1Prompt(
          ideMessenger,
          command,
          userInput,
          selectedCode,
        );
      } else {
        const promptFileCtxRequests = await getPromptV2ContextRequests(
          ideMessenger,
          command,
        );
        contextRequests.push(...promptFileCtxRequests);
        renderedPrompt = [command.prompt, userInput].join("\n\n").trim();
      }

      if (renderedPrompt) {
        slashedParts.push({
          type: "text",
          text: renderedPrompt,
        });
      } else {
        console.warn(
          `Invalid/empty prompt + input from slash command ${command.name}`,
        );
      }
      break;
    }
    case "built-in": {
      if (!command.prompt) {
        console.warn(`Slash command ${command.name} is missing prompt`);
        break;
      }
      let rendered = command.prompt;
      if (userInput) {
        rendered += `\n\n${userInput}`;
      }
      if (rendered) {
        slashedParts.push({
          type: "text",
          text: rendered,
        });
      } else {
        console.warn(
          `Invalid/empty prompt + input from slash command ${command.name}`,
        );
      }
      break;
    }
    default:
      break;
  }

  return {
    slashedParts,
    legacyCommandWithInput,
    contextRequests,
  };
}
