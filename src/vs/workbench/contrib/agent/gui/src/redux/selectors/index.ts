import { createSelector } from "@reduxjs/toolkit";
import { BuiltInToolNames } from "core/tools/builtIn";
import {
  ComboBoxItem,
  ComboBoxItemType,
} from "../../components/mainInput/types";
import { RootState } from "../store";

function toolActivity(name: string): string {
  switch (name) {
    case BuiltInToolNames.RunTerminalCommand: return "Running command...";
    case BuiltInToolNames.ReadFile:
    case BuiltInToolNames.ReadFileRange:
    case BuiltInToolNames.ReadCurrentlyOpenFile: return "Reading file...";
    case BuiltInToolNames.GrepSearch:
    case BuiltInToolNames.FileGlobSearch: return "Searching files...";
    case BuiltInToolNames.LSTool:
    case BuiltInToolNames.ViewSubdirectory: return "Exploring files...";
    case BuiltInToolNames.WebSearch: return "Searching the web...";
    case BuiltInToolNames.EditExistingFile:
    case BuiltInToolNames.SingleFindAndReplace:
    case BuiltInToolNames.MultiEdit: return "Editing files...";
    case BuiltInToolNames.CreateNewFile: return "Creating file...";
    case BuiltInToolNames.ViewDiff: return "Reviewing changes...";
    case BuiltInToolNames.WriteTodos: return "Updating tasks...";
    case BuiltInToolNames.ReadSkill: return "Reading instructions...";
    case BuiltInToolNames.CreateRuleBlock:
    case BuiltInToolNames.RequestRule: return "Working with rules...";
    default: return "Working...";
  }
}

export const selectSlashCommandComboBoxInputs = createSelector(
  [(state: RootState) => state.config.config.slashCommands],
  (slashCommands) => {
    return (
      slashCommands?.map((cmd) => {
        // MCP prompts load content lazily on invoke — not a failure.
        const content =
          cmd.source === "mcp-prompt" && !cmd.prompt
            ? undefined
            : cmd.prompt;

        return {
          title: cmd.name,
          description:
            cmd.source === "mcp-prompt" && cmd.mcpServerName
              ? `${cmd.description} (${cmd.mcpServerName})`
              : cmd.description,
          type: "slashCommand" as ComboBoxItemType,
          content,
          source: cmd.source,
          slashCommandSource: cmd.source,
        } as ComboBoxItem;
      }) || []
    );
  },
);

export const selectSubmenuContextProviders = createSelector(
  [(state: RootState) => state.config.config.contextProviders],
  (providers) => {
    return providers?.filter((desc) => desc?.type === "submenu") || [];
  },
);

export const selectStreamingStatus = createSelector(
  [(state: RootState) => state.session],
  (session) => {
    if (!session.isStreaming) return null;

    const lastItem = session.history.at(-1);
    if (!lastItem) return "Analyzing requirements...";

    if (lastItem.isGatheringContext) {
      return "Gathering relevant context...";
    }

    const activeTools =
      lastItem.toolCallStates?.filter(
        (t) => t.status === "generating" || t.status === "calling",
      ) ?? [];
    const researchTool = activeTools.find(
      (t) => t.toolCall.function?.name !== "create_plan",
    );
    if (researchTool) {
      return toolActivity(researchTool.toolCall.function?.name ?? "");
    }
    if (activeTools.length > 0) {
      return "Creating plan...";
    }

    if (
      lastItem.message.role === "thinking" ||
      lastItem.reasoning?.active
    ) {
      return "Thinking...";
    }

    if (lastItem.message.content) {
      return "Responding...";
    }

    return "Preparing your response...";
  },
);
