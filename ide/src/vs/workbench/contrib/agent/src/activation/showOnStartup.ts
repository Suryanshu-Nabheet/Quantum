import * as vscode from "vscode";

import { isBuiltinQuantumAgent, openAgentPanel } from "../util/quantumIntegration";

/**
 * When Agent is Quantum's built-in AI surface, show the panel on first launch.
 */
export async function showQuantumAgentOnStartup(
  context: vscode.ExtensionContext,
): Promise<void> {
  if (!isBuiltinQuantumAgent(context)) {
    return;
  }

  const openOnStartup = vscode.workspace
    .getConfiguration("agent")
    .get<boolean>("openOnStartup", false);
  if (!openOnStartup) {
    return;
  }

  // View containers register slightly after extension activation.
  await new Promise((resolve) => setTimeout(resolve, 300));

  try {
    await openAgentPanel(false);
  } catch (err) {
    console.warn("[Agent] open on startup failed:", err);
  }
}
