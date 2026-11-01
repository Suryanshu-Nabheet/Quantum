import { ContextItem, ToolExtras } from "../..";
import { AGENT_BROWSER_TOOL_IDS } from "../../../shared/browser.js";

export async function invokeBrowserToolImpl(
  args: Record<string, unknown>,
  extras: ToolExtras,
): Promise<ContextItem[]> {
  const toolId = extras.tool.function.name;
  if (!AGENT_BROWSER_TOOL_IDS.includes(toolId as (typeof AGENT_BROWSER_TOOL_IDS)[number])) {
    throw new Error(`Unknown browser tool: ${toolId}`);
  }

  const output = await extras.ide.invokeBrowserTool(toolId, args);

  return [
    {
      name: extras.tool.displayTitle,
      description: toolId,
      content: output,
    },
  ];
}

export function isBrowserToolName(name: string): boolean {
  return AGENT_BROWSER_TOOL_IDS.includes(name as (typeof AGENT_BROWSER_TOOL_IDS)[number]);
}
