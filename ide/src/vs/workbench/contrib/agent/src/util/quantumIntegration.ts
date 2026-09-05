import * as vscode from "vscode";
import {
  AGENT_EXTENSION_ID,
  AGENT_GUI_VIEW_ID,
  AGENT_VIEW_CONTAINER_ID,
} from "../../shared/ids";

export { AGENT_EXTENSION_ID, AGENT_GUI_VIEW_ID, AGENT_VIEW_CONTAINER_ID };

/** True when loaded as Quantum's generated built-in extension. */
export function isBuiltinQuantumAgent(
  context: vscode.ExtensionContext,
): boolean {
  const normalized = context.extensionPath.replace(/\\/g, "/");
  return normalized.includes("/out/agent");
}

/** Open the Agent panel in the secondary sidebar and focus the chat view. */
export async function openAgentPanel(focusInput: boolean = false): Promise<void> {
  await vscode.commands.executeCommand(AGENT_VIEW_CONTAINER_ID);
  await vscode.commands.executeCommand(`${AGENT_GUI_VIEW_ID}.focus`);
  if (focusInput) {
    await vscode.commands.executeCommand("agent.focusAgentInputWithoutClear");
  }
}

/** Hide the Agent panel (secondary sidebar). */
export async function hideAgentPanel(): Promise<void> {
  await vscode.commands.executeCommand("workbench.action.closeAuxiliaryBar");
}

/** Toggle Agent panel visibility. Pass sidebar.isVisible when available. */
export async function toggleAgentPanel(isCurrentlyVisible?: boolean): Promise<void> {
  if (isCurrentlyVisible) {
    await hideAgentPanel();
  } else {
    await openAgentPanel(false);
  }
}
