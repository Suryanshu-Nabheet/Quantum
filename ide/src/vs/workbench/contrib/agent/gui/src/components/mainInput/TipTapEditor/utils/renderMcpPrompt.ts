import { SlashCommandDescWithSource } from "core";
import { IIdeMessenger } from "../../../../context/IdeMessenger";

export async function renderMcpPrompt(
  command: SlashCommandDescWithSource,
  ideMessenger: IIdeMessenger,
  userInput?: string,
) {
  const args: { [key: string]: string } = {};
  if (command.mcpArgs) {
    for (const arg of command.mcpArgs) {
      args[arg.name] = "";
    }
    if (userInput?.trim()) {
      const target =
        command.mcpArgs.find((arg) => arg.required) ?? command.mcpArgs[0];
      if (target) {
        args[target.name] = userInput.trim();
      }
    }
  }
  const response = await ideMessenger.request("mcp/getPrompt", {
    serverName: command.mcpServerName!,
    promptName: command.name,
    args: args,
  });
  if (response.status === "success") {
    let renderedPrompt = response.content.prompt;
    if (userInput) {
      renderedPrompt += `\n\n${userInput}`;
    }
    return renderedPrompt;
  } else {
    throw new Error(
      `Failed to get MCP prompt for slash command ${command.name}`,
    );
  }
}
