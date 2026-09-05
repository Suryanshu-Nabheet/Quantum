import { Prompt } from "agent-config";
import { SlashCommandWithSource } from "../..";

export function convertPromptBlockToSlashCommand(
  prompt: Prompt,
): SlashCommandWithSource {
  return {
    name: prompt.name,
    description: prompt.description ?? "",
    prompt: prompt.prompt,
    source: "quantum-settings-prompt",
    sourceFile: prompt.sourceFile,
  };
}
