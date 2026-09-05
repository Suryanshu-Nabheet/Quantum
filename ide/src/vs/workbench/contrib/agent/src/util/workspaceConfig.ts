import { workspace } from "vscode";

export const AGENT_WORKSPACE_KEY = "agent";

export function getAgentWorkspaceConfig() {
  return workspace.getConfiguration(AGENT_WORKSPACE_KEY);
}
