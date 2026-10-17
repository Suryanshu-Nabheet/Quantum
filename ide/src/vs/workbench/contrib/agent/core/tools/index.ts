import { ConfigDependentToolParams, Tool } from "..";

export type { Tool };
import { isRecommendedAgentModel } from "../llm/toolSupport";
import * as toolDefinitions from "./definitions";

// I'm writing these as functions because we've messed up 3 TIMES by pushing to const, causing duplicate tool definitions on subsequent config loads.
export const getBaseToolDefinitions = () => [
  toolDefinitions.readFileTool,
  toolDefinitions.createNewFileTool,
  toolDefinitions.runTerminalCommandTool,
  toolDefinitions.globSearchTool,
  toolDefinitions.viewDiffTool,
  toolDefinitions.readCurrentlyOpenFileTool,
  toolDefinitions.lsTool,
  toolDefinitions.createRuleBlock,
];

export const getConfigDependentToolDefinitions = async (
  params: ConfigDependentToolParams,
): Promise<Tool[]> => {
  const { enableHeavyTools, modelName } = params;
  const tools: Tool[] = [];

  tools.push(await toolDefinitions.requestRuleTool(params));
  tools.push(await toolDefinitions.readSkillTool(params));
  tools.push(await toolDefinitions.writeTodosTool(params));
  tools.push(await toolDefinitions.createPlanTool(params));

  tools.push(toolDefinitions.readFileRangeTool);

  if (modelName && isRecommendedAgentModel(modelName)) {
    tools.push(toolDefinitions.multiEditTool);
  } else {
    tools.push(toolDefinitions.singleFindAndReplaceTool);
  }

  // Browser tools stay in config. A codebase turn drops them before the model call.
  tools.push(...toolDefinitions.browserToolDefinitions);

  tools.push(toolDefinitions.grepSearchTool);
  if (enableHeavyTools) {
    tools.push(toolDefinitions.viewSubdirectoryTool);
  }

  return tools;
};

export function serializeTool(tool: Tool) {
  const { preprocessArgs, evaluateToolCallPolicy, ...rest } = tool;
  return rest;
}
