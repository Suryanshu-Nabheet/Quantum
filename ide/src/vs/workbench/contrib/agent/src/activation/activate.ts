import { GlobalContext } from "core/util/GlobalContext";
import { getAgentRcPath } from "core/util/paths";
import * as vscode from "vscode";

import { WorkbenchExtension } from "../extension/WorkbenchExtension";
import { PRODUCT_NAME } from "../util/extensionMeta";
import { isUnsupportedPlatform } from "../util/util";

import { WorkbenchAgentApi } from "./api";
import setupInlineTips from "./InlineTipManager";

let activeExtension: WorkbenchExtension | undefined;

export async function activateExtension(context: vscode.ExtensionContext) {
  const platformCheck = isUnsupportedPlatform();
  const globalContext = new GlobalContext();
  const hasShownUnsupportedPlatformWarning = globalContext.get(
    "hasShownUnsupportedPlatformWarning",
  );

  if (platformCheck.isUnsupported && !hasShownUnsupportedPlatformWarning) {
    const platformTarget = "windows-arm64";

    globalContext.update("hasShownUnsupportedPlatformWarning", true);
    void vscode.window.showInformationMessage(
      `${PRODUCT_NAME} detected that you are using ${platformTarget}. Due to native dependencies, ${PRODUCT_NAME} may not be able to start`,
    );
  }

  getAgentRcPath();

  if (
    vscode.workspace
      .getConfiguration("agent")
      .get<boolean>("showInlineTip", false)
  ) {
    setupInlineTips(context);
  }

  const workbenchExtension = new WorkbenchExtension(context);
  activeExtension = workbenchExtension;

  if (!context.globalState.get("hasBeenInstalled")) {
    void context.globalState.update("hasBeenInstalled", true);
  }

  const api = new WorkbenchAgentApi(workbenchExtension);
  const agentPublicApi = {
    registerCustomContextProvider: api.registerCustomContextProvider.bind(api),
  };

  return process.env.NODE_ENV === "test"
    ? {
        ...agentPublicApi,
        extension: workbenchExtension,
      }
    : agentPublicApi;
}

export function deactivateExtension() {
  activeExtension?.dispose();
  activeExtension = undefined;
}
