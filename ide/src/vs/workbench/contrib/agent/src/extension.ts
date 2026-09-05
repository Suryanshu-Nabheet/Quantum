import { setupCa } from "core/util/ca";
import * as vscode from "vscode";

import { PRODUCT_NAME } from "./util/extensionMeta";

async function dynamicImportAndActivate(context: vscode.ExtensionContext) {
  await setupCa();
  const { activateExtension } = await import("./activation/activate");
  return await activateExtension(context);
}

export function activate(context: vscode.ExtensionContext) {
  return dynamicImportAndActivate(context).catch((e) => {
    console.error("Error activating Agent: ", e);
    vscode.window
      .showWarningMessage(
        `Error activating ${PRODUCT_NAME}.`,
        "View Logs",
        "Retry",
      )
      .then((selection) => {
        if (selection === "View Logs") {
          vscode.commands.executeCommand("agent.viewLogs");
        } else if (selection === "Retry") {
          // Reload VS Code window
          vscode.commands.executeCommand("workbench.action.reloadWindow");
        }
      });
  });
}

export async function deactivate() {
  const { deactivateExtension } = await import("./activation/activate");
  deactivateExtension();
}
