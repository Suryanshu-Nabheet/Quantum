import { createSelector } from "@reduxjs/toolkit";
import {
  ComboBoxItem,
  ComboBoxItemType,
} from "../../components/mainInput/types";
import { RootState } from "../store";

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

    const activeTool = lastItem.toolCallStates?.find(
      (t) => t.status === "generating" || t.status === "calling",
    );
    if (activeTool) {
      return `Executing ${activeTool.toolCall.function?.name || "action"}...`;
    }

    if (
      lastItem.message.role === "thinking" ||
      lastItem.reasoning?.active
    ) {
      return "Thinking through implementation...";
    }

    if (lastItem.message.content) {
      return "Streaming response...";
    }

    return "Preparing your response...";
  },
);
