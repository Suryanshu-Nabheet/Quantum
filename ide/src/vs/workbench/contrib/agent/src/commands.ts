/* eslint-disable @typescript-eslint/naming-convention */
import * as fs from "node:fs";

import { ContextMenuConfig, ILLM, ModelInstaller } from "core";
import { CompletionProvider } from "core/autocomplete/CompletionProvider";
import { ConfigHandler } from "core/config/ConfigHandler";
import { Core } from "core/core";
import { walkDirAsync } from "core/indexing/walkDir";
import { isModelInstaller } from "core/llm";
import { startLocalLemonade } from "core/util/lemonadeHelper";
import { startLocalOllama } from "core/util/ollamaHelper";
import * as vscode from "vscode";

import { AgentGUIWebviewViewProvider } from "./AgentGUIWebviewViewProvider";
import { AgentCompletionProvider } from "./autocomplete/completionProvider";
import {
  getAutocompleteStatusBarDescription,
  getAutocompleteStatusBarTitle,
  getStatusBarStatus,
  getStatusBarStatusFromQuickPickItemLabel,
  quickPickStatusText,
  setupStatusBar,
  StatusBarStatus,
} from "./autocomplete/statusBar";
import { processDiff } from "./diff/processDiff";
import { VerticalDiffManager } from "./diff/vertical/manager";
import { addCurrentSelectionToEdit } from "./quickEdit/AddCurrentSelection";
import EditDecorationManager from "./quickEdit/EditDecorationManager";
import { QuickEdit, QuickEditShowParams } from "./quickEdit/QuickEditQuickPick";
import {
  addEntireFileToContext,
  addHighlightedCodeToContext,
} from "./util/addCode";
import { Battery } from "./util/battery";
import { EXTENSION_NAME } from "./util/constants";
import { PRODUCT_NAME, QUANTUM_SETTINGS } from "./util/extensionMeta";
import { openAgentPanel, hideAgentPanel, toggleAgentPanel } from "./util/quantumIntegration";
import { getMetaKeyLabel } from "./util/util";
import {
	AGENT_ATTACH_BROWSER_CONTEXT_COMMAND,
	AGENT_BROWSER_NOTIFY_SUBMIT_COMMAND,
	type AgentAttachBrowserContextArgs,
} from "../shared/browser";
import { VsCodeIde } from "./VsCodeIde";

let fullScreenPanel: vscode.WebviewPanel | undefined;
let configPanel: vscode.WebviewPanel | undefined;

function getFullScreenTab() {
  const tabs = vscode.window.tabGroups.all.flatMap((tabGroup) => tabGroup.tabs);
  return tabs.find((tab) =>
    (tab.input as any)?.viewType?.endsWith("agent.agentGUIView"),
  );
}

function focusGUI(forceSidebar: boolean = false) {
  const fullScreenTab = getFullScreenTab();
  if (fullScreenTab && !forceSidebar) {
    fullScreenPanel?.reveal();
  } else {
    void openAgentPanel(false);
  }
}

function hideGUI() {
  const fullScreenTab = getFullScreenTab();
  if (fullScreenTab) {
    fullScreenPanel?.dispose();
  } else {
    void hideAgentPanel();
  }
}

function waitForSidebarReady(
  sidebar: AgentGUIWebviewViewProvider,
  timeout: number,
  interval: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const checkReadyState = () => {
      if (sidebar.isReady) {
        resolve(true);
      } else if (Date.now() - startTime >= timeout) {
        resolve(false); // Timed out
      } else {
        setTimeout(checkReadyState, interval);
      }
    };

    checkReadyState();
  });
}

async function ensureSidebarReady(
  sidebar: AgentGUIWebviewViewProvider,
): Promise<boolean> {
  focusGUI();
  if (sidebar.isReady) {
    return true;
  }
  const isReady = await waitForSidebarReady(sidebar, 5000, 100);
  if (!isReady) {
    void vscode.window.showWarningMessage(
      `${PRODUCT_NAME} sidebar is not ready. Reopen the Agent view or reload the window.`,
    );
  }
  return isReady;
}

async function attachBrowserContextToAgent(
  sidebar: AgentGUIWebviewViewProvider,
  args: AgentAttachBrowserContextArgs,
): Promise<void> {
  await openAgentPanel(true);

  const ready = await waitForSidebarReady(sidebar, 5000, 100);
  if (!ready) {
    return;
  }

  await sidebar.webviewProtocol?.request("navigateTo", { path: "/", toggle: false });

  for (let attempt = 0; attempt < 30; attempt++) {
    const editorStatus = await sidebar.webviewProtocol?.request(
      "isMainEditorReady",
      undefined,
    );
    if (editorStatus?.ready) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const payload = {
    name: args.name,
    description: args.description,
    content: args.content,
    uri: args.uri,
    providerTitle: args.providerTitle ?? "browser",
  };

  const result = await sidebar.webviewProtocol?.request(
    "attachBrowserContext",
    payload,
  );
  if (result?.attached) {
    return;
  }

  for (let attempt = 0; attempt < 10; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const retry = await sidebar.webviewProtocol?.request(
      "attachBrowserContext",
      payload,
    );
    if (retry?.attached) {
      return;
    }
  }

  void vscode.window.showWarningMessage(
    `${PRODUCT_NAME} could not attach browser context. Focus the Agent chat and try again.`,
  );
}

function showInlineEditError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Inline edit failed";
  void vscode.window.showErrorMessage(message);
}

// Copy everything over from extension.ts
const getCommandsMap: (
  ide: VsCodeIde,
  extensionContext: vscode.ExtensionContext,
  sidebar: AgentGUIWebviewViewProvider,
  configHandler: ConfigHandler,
  verticalDiffManager: VerticalDiffManager,
  battery: Battery,
  quickEdit: QuickEdit,
  core: Core,
  editDecorationManager: EditDecorationManager,
) => { [command: string]: (...args: any) => any } = (
  ide,
  extensionContext,
  sidebar,
  configHandler,
  verticalDiffManager,
  battery,
  quickEdit,
  core,
  editDecorationManager,
) => {
  /**
   * Streams an inline edit to the vertical diff manager.
   *
   * and then streams an edit to the
   * vertical diff manager.
   *
   * @param  promptName - The key for the prompt in the context menu configuration.
   * @param  fallbackPrompt - The prompt to use if the configured prompt is not available.
   * @param  [range] - Optional. The range to edit if provided.
   * @returns
   */
  async function streamInlineEdit(
    promptName: keyof ContextMenuConfig,
    fallbackPrompt: string,
    range?: vscode.Range,
  ) {
    const { config } = await configHandler.loadConfig();
    if (!config) {
      throw new Error("Config not loaded");
    }

    const llm =
      config.selectedModelByRole.edit ?? config.selectedModelByRole.chat;

    if (!llm) {
      throw new Error("No edit or chat model selected");
    }


    await verticalDiffManager.streamEdit({
      input:
        config.experimental?.contextMenuPrompts?.[promptName] ?? fallbackPrompt,
      llm,
      range,
      rulesToInclude: config.rules,
      isApply: false,
    });
  }

  return {
    "agent.openPanel": async () => {
      await openAgentPanel(false);
    },
    "agent.hidePanel": async () => {
      await hideAgentPanel();
    },
    "agent.togglePanel": async () => {
      await toggleAgentPanel(sidebar.isVisible);
    },
    "agent.acceptDiff": async (newFileUri?: string, streamId?: string) => {
      void processDiff(
        "accept",
        sidebar,
        ide,
        core,
        verticalDiffManager,
        newFileUri,
        streamId,
      );
    },

    "agent.rejectDiff": async (newFileUri?: string, streamId?: string) => {
      void processDiff(
        "reject",
        sidebar,
        ide,
        core,
        verticalDiffManager,
        newFileUri,
        streamId,
      );
    },
    "agent.acceptVerticalDiffBlock": (fileUri?: string, index?: number) => {
      verticalDiffManager.acceptRejectVerticalDiffBlock(true, fileUri, index);
    },
    "agent.rejectVerticalDiffBlock": (fileUri?: string, index?: number) => {
      verticalDiffManager.acceptRejectVerticalDiffBlock(false, fileUri, index);
    },
    "agent.focusAgentInput": async () => {
      if (!(await ensureSidebarReady(sidebar))) {
        return;
      }

      const isAgentInputFocused = await sidebar.webviewProtocol.request(
        "isAgentInputFocused",
        undefined,
        false,
      );

      const historyLength = await sidebar.webviewProtocol.request(
        "getWebviewHistoryLength",
        undefined,
        false,
      );

      if (isAgentInputFocused) {
        if (historyLength === 0) {
          hideGUI();
        } else {
          void sidebar.webviewProtocol?.request(
            "focusAgentInputWithNewSession",
            undefined,
            false,
          );
        }
      } else {
        focusGUI();
        sidebar.webviewProtocol?.request(
          "focusAgentInputWithNewSession",
          undefined,
          false,
        );
        void addHighlightedCodeToContext(sidebar.webviewProtocol);
      }
    },
    "agent.focusAgentInputWithoutClear": async () => {
      if (!(await ensureSidebarReady(sidebar))) {
        return;
      }

      const isAgentInputFocused = await sidebar.webviewProtocol.request(
        "isAgentInputFocused",
        undefined,
        false,
      );

      if (isAgentInputFocused) {
        hideGUI();
      } else {
        focusGUI();

        sidebar.webviewProtocol?.request(
          "focusAgentInputWithoutClear",
          undefined,
        );

        void addHighlightedCodeToContext(sidebar.webviewProtocol);
      }
    },
    // QuickEditShowParams are also used when opening edit for a supplied range.
    "agent.focusEdit": async (args?: QuickEditShowParams) => {
      if (!(await ensureSidebarReady(sidebar))) {
        return;
      }
      if (args?.range) {
        await addCurrentSelectionToEdit({
          args,
          editDecorationManager,
          webviewProtocol: sidebar.webviewProtocol,
          verticalDiffManager,
        });
      }
      await sidebar.webviewProtocol?.request("focusEdit", undefined);
    },
    "agent.exitEditMode": async () => {
      editDecorationManager.clear();
      void sidebar.webviewProtocol?.request("exitEditMode", undefined);
    },
    "agent.generateRule": async () => {
      focusGUI();
      void sidebar.webviewProtocol?.request("generateRule", undefined);
    },
    [AGENT_ATTACH_BROWSER_CONTEXT_COMMAND]: async (
      ...commandArgs: unknown[]
    ) => {
      const args = commandArgs[0] as AgentAttachBrowserContextArgs | undefined;
      if (!args?.content?.trim()) {
        return;
      }

      await attachBrowserContextToAgent(sidebar, args);
    },
    "agent.writeCommentsForCode": async () => {
      try {
        await streamInlineEdit(
          "comment",
          "Write comments for this code. Do not change anything about the code itself.",
        );
      } catch (e) {
        showInlineEditError(e);
      }
    },
    "agent.writeDocstringForCode": async () => {
      try {
        await streamInlineEdit(
          "docstring",
          "Write a docstring for this code. Do not change anything about the code itself.",
        );
      } catch (e) {
        showInlineEditError(e);
      }
    },
    "agent.fixCode": async () => {
      try {
        await streamInlineEdit(
          "fix",
          "Fix this code. If it is already 100% correct, simply rewrite the code.",
        );
      } catch (e) {
        showInlineEditError(e);
      }
    },
    "agent.optimizeCode": async () => {
      try {
        await streamInlineEdit("optimize", "Optimize this code");
      } catch (e) {
        showInlineEditError(e);
      }
    },
    "agent.fixGrammar": async () => {
      try {
        await streamInlineEdit(
          "fixGrammar",
          "If there are any grammar or spelling mistakes in this writing, fix them. Do not make other large changes to the writing.",
        );
      } catch (e) {
        showInlineEditError(e);
      }
    },
    "agent.viewLogs": async () => {
      vscode.commands.executeCommand("workbench.action.toggleDevTools");
    },
    "agent.debugTerminal": async () => {

      const terminalContents = await ide.getTerminalContents();

      await openAgentPanel(false);

      sidebar.webviewProtocol?.request("userInput", {
        input: `I got the following error, can you please help explain how to fix it?\n\n${terminalContents.trim()}`,
      });
    },
    "agent.hideInlineTip": () => {
      vscode.workspace
        .getConfiguration(EXTENSION_NAME)
        .update("showInlineTip", false, vscode.ConfigurationTarget.Global);
    },

    // Commands without keyboard shortcuts
    "agent.addModel": async () => {
      await openAgentPanel(false);
      sidebar.webviewProtocol?.request("addModel", undefined);
    },
    "agent.newSession": () => {
      sidebar.webviewProtocol?.request("newSession", undefined);
    },

    "agent.shareSession": async (sessionId: string | undefined) => {
      if (!sessionId) {
        sessionId = await sidebar.webviewProtocol?.request(
          "getCurrentSessionId",
          undefined,
        );
      }
      if (!sessionId) {
        void vscode.window.showErrorMessage(
          "No session ID found. Please start a new session first.",
        );
        return;
      }
      //let user select the destination folder
      const destinationFolder = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: "Select Destination Folder",
      });
      if (!destinationFolder || destinationFolder.length === 0) {
        return;
      }

      try {
        // despite core.invoke not being async, we still need to await it, because the 'history/share' command is async
        // if not awaited, then errors will not be caught.
        await core.invoke("history/share", {
          id: sessionId,
          outputDir: destinationFolder[0].fsPath,
        });
      } catch (error) {
        const errorMessage = `Failed to save session: ${error instanceof Error ? error.message : String(error)}`;
        void vscode.window.showErrorMessage(errorMessage);
      }
    },
    "agent.viewHistory": () => {
      vscode.commands.executeCommand("agent.navigateTo", "/history", true);
    },
    "agent.focusAgentSessionId": async (
      sessionId: string | undefined,
    ) => {
      if (!sessionId) {
        sessionId = await vscode.window.showInputBox({
          prompt: "Enter the Session ID",
        });
      }
      void sidebar.webviewProtocol?.request("focusAgentSessionId", {
        sessionId,
      });
    },
    "agent.applyCodeFromChat": () => {
      void sidebar.webviewProtocol.request("applyCodeFromChat", undefined);
    },
    "agent.openConfigPage": () => {
      if (configPanel) {
        configPanel.reveal();
        return;
      }

      configPanel = vscode.window.createWebviewPanel(
        "agent.configView",
        QUANTUM_SETTINGS,
        vscode.ViewColumn.One,
        {
          enableScripts: true,
        },
      );

      configPanel.iconPath = new vscode.ThemeIcon("settings-gear") as any;

      configPanel.webview.html = sidebar.getSidebarContent(
        extensionContext,
        configPanel,
        "/config",
        undefined,
        true,
      );

      const webview = configPanel.webview;
      configPanel.onDidDispose(
        () => {
          sidebar.webviewProtocol.removeWebview(webview);
          configPanel = undefined;
        },
        null,
        extensionContext.subscriptions,
      );
    },
    "agent.selectFilesAsContext": async (
      firstUri: vscode.Uri,
      uris: vscode.Uri[],
    ) => {
      if (uris === undefined) {
        throw new Error("No files were selected");
      }

      await openAgentPanel(false);

      for (const uri of uris) {
        // If it's a folder, add the entire folder contents recursively by using walkDir (to ignore ignored files)
        const isDirectory = await vscode.workspace.fs
          .stat(uri)
          ?.then((stat) => stat.type === vscode.FileType.Directory);
        if (isDirectory) {
          for await (const fileUri of walkDirAsync(uri.toString(), ide, {
            source: "vscode agent.selectFilesAsContext command",
          })) {
            await addEntireFileToContext(
              vscode.Uri.parse(fileUri),
              sidebar.webviewProtocol,
              ide.ideUtils,
            );
          }
        } else {
          await addEntireFileToContext(
            uri,
            sidebar.webviewProtocol,
            ide.ideUtils,
          );
        }
      }
    },
    "agent.logAutocompleteOutcome": (
      completionId: string,
      completionProvider: CompletionProvider,
    ) => {
      completionProvider.accept(completionId);
      AgentCompletionProvider.chainAfterAcceptGlobal();
    },
    "agent.toggleTabAutocompleteEnabled": () => {

      const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
      const enabled = config.get("enableTabAutocomplete");
      const pauseOnBattery = config.get<boolean>(
        "pauseTabAutocompleteOnBattery",
      );
      if (!pauseOnBattery || battery.isACConnected()) {
        config.update(
          "enableTabAutocomplete",
          !enabled,
          vscode.ConfigurationTarget.Global,
        );
      } else {
        if (enabled) {
          const paused = getStatusBarStatus() === StatusBarStatus.Paused;
          if (paused) {
            setupStatusBar(StatusBarStatus.Enabled);
          } else {
            config.update(
              "enableTabAutocomplete",
              false,
              vscode.ConfigurationTarget.Global,
            );
          }
        } else {
          setupStatusBar(StatusBarStatus.Paused);
          config.update(
            "enableTabAutocomplete",
            true,
            vscode.ConfigurationTarget.Global,
          );
        }
      }
    },
    "agent.forceAutocomplete": async () => {

      // 1. Explicitly hide any existing suggestion. This clears VS Code's cache for the current position.
      await vscode.commands.executeCommand("editor.action.inlineSuggest.hide");

      // 2. Now trigger a new one. VS Code has no cached suggestion, so it's forced to call our provider.
      await vscode.commands.executeCommand(
        "editor.action.inlineSuggest.trigger",
      );
    },

    "agent.openTabAutocompleteConfigMenu": async () => {

      const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
      const quickPick = vscode.window.createQuickPick();

      const { config: agentConfig } = await configHandler.loadConfig();
      const autocompleteModels =
        agentConfig?.modelsByRole.autocomplete ?? [];
      const selected =
        agentConfig?.selectedModelByRole?.autocomplete?.title ?? undefined;

      // Toggle between Disabled, Paused, and Enabled
      const pauseOnBattery =
        config.get<boolean>("pauseTabAutocompleteOnBattery") &&
        !battery.isACConnected();
      const currentStatus = getStatusBarStatus();

      let targetStatus: StatusBarStatus | undefined;
      if (pauseOnBattery) {
        // Cycle from Disabled -> Paused -> Enabled
        targetStatus =
          currentStatus === StatusBarStatus.Paused
            ? StatusBarStatus.Enabled
            : currentStatus === StatusBarStatus.Disabled
              ? StatusBarStatus.Paused
              : StatusBarStatus.Disabled;
      } else {
        // Toggle between Disabled and Enabled
        targetStatus =
          currentStatus === StatusBarStatus.Disabled
            ? StatusBarStatus.Enabled
            : StatusBarStatus.Disabled;
      }

      quickPick.items = [
        {
          label: "$(gear) Open settings",
        },
        {
          label: "$(comment) Open chat",
          description: getMetaKeyLabel() + " + L",
        },
        {
          label: "$(screen-full) Open full screen chat",
          description:
            getMetaKeyLabel() + " + K, " + getMetaKeyLabel() + " + M",
        },
        {
          label: quickPickStatusText(targetStatus),
          description:
            getMetaKeyLabel() + " + K, " + getMetaKeyLabel() + " + A",
        },
        {
          kind: vscode.QuickPickItemKind.Separator,
          label: "Switch model",
        },
        ...autocompleteModels.map((model) => ({
          label: getAutocompleteStatusBarTitle(selected, model),
          description: getAutocompleteStatusBarDescription(selected, model),
        })),
      ];
      quickPick.onDidAccept(() => {
        const selectedOption = quickPick.selectedItems[0].label;
        const targetStatus =
          getStatusBarStatusFromQuickPickItemLabel(selectedOption);

        if (targetStatus !== undefined) {
          setupStatusBar(targetStatus);
          config.update(
            "enableTabAutocomplete",
            targetStatus === StatusBarStatus.Enabled,
            vscode.ConfigurationTarget.Global,
          );
        } else if (
          autocompleteModels.some((model) => model.title === selectedOption)
        ) {
          if (core.configHandler.currentProfile?.profileDescription.id) {
            core.invoke("config/updateSelectedModel", {
              profileId:
                core.configHandler.currentProfile?.profileDescription.id,
              role: "autocomplete",
              title: selectedOption,
            });
          }
        } else if (selectedOption === "$(comment) Open chat") {
          vscode.commands.executeCommand("agent.focusAgentInput");
        } else if (selectedOption === "$(screen-full) Open full screen chat") {
          vscode.commands.executeCommand("agent.openInNewWindow");
        } else if (selectedOption === "$(gear) Open settings") {
          vscode.commands.executeCommand("agent.openConfigPage");
        }

        quickPick.dispose();
      });
      quickPick.show();
    },
    "agent.navigateTo": (path: string, toggle: boolean) => {
      sidebar.webviewProtocol?.request("navigateTo", { path, toggle });
      const forceSidebar = path === "/history" || path === "/";
      focusGUI(forceSidebar);
    },
    "agent.startLocalOllama": () => {
      startLocalOllama(ide);
    },
    "agent.startLocalLemonade": () => {
      startLocalLemonade(ide);
    },
    "agent.installModel": async (
      modelName: string,
      llmProvider: ILLM | undefined,
    ) => {
      try {
        if (!isModelInstaller(llmProvider)) {
          const msg = llmProvider
            ? `LLM provider '${llmProvider.providerName}' does not support installing models`
            : "Missing LLM Provider";
          throw new Error(msg);
        }
        await installModelWithProgress(modelName, llmProvider);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        vscode.window.showErrorMessage(
          `Failed to install '${modelName}': ${message}`,
        );
      }
    },
    "agent.openInNewWindow": async () => {
      focusGUI();

      const sessionId = await sidebar.webviewProtocol.request(
        "getCurrentSessionId",
        undefined,
      );
      // Check if full screen is already open by checking open tabs
      const fullScreenTab = getFullScreenTab();

      if (fullScreenTab && fullScreenPanel) {
        // Full screen open, but not focused - focus it
        fullScreenPanel.reveal();
        return;
      }

      // Clear the sidebar to prevent overwriting changes made in fullscreen
      vscode.commands.executeCommand("agent.newSession");

      // Full screen not open - open it

      // Create the full screen panel
      let panel = vscode.window.createWebviewPanel(
        "agent.agentGUIView",
        PRODUCT_NAME,
        vscode.ViewColumn.One,
        {
          enableScripts: true,
        },
      );
      fullScreenPanel = panel;

      // Add content to the panel
      panel.webview.html = sidebar.getSidebarContent(
        extensionContext,
        panel,
        undefined,
        undefined,
        true,
      );

      const sessionLoader = panel.onDidChangeViewState(() => {
        vscode.commands.executeCommand("agent.newSession");
        if (sessionId) {
          vscode.commands.executeCommand(
            "agent.focusAgentSessionId",
            sessionId,
          );
        }
        panel.reveal();
        sessionLoader.dispose();
      });

      // When panel closes, reset the webview and focus
      panel.onDidDispose(
        () => {
          sidebar.resetWebviewProtocolWebview();
          vscode.commands.executeCommand("agent.focusAgentInput");
        },
        null,
        extensionContext.subscriptions,
      );

      vscode.commands.executeCommand("workbench.action.copyEditorToNewWindow");
      vscode.commands.executeCommand("workbench.action.closeAuxiliaryBar");
    },
  };
};

async function installModelWithProgress(
  modelName: string,
  modelInstaller: ModelInstaller,
) {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Installing model '${modelName}'`,
      cancellable: true,
    },
    async (windowProgress, token) => {
      let currentProgress: number = 0;
      const progressWrapper = (
        details: string,
        worked?: number,
        total?: number,
      ) => {
        let increment = 0;
        if (worked && total) {
          const progressValue = Math.round((worked / total) * 100);
          increment = progressValue - currentProgress;
          currentProgress = progressValue;
        }
        windowProgress.report({ message: details, increment });
      };
      const abortController = new AbortController();
      token.onCancellationRequested(() => {
        console.log(`Pulling ${modelName} model was cancelled`);
        abortController.abort();
      });
      await modelInstaller.installModel(
        modelName,
        abortController.signal,
        progressWrapper,
      );
    },
  );
}

export function registerAllCommands(
  context: vscode.ExtensionContext,
  ide: VsCodeIde,
  extensionContext: vscode.ExtensionContext,
  sidebar: AgentGUIWebviewViewProvider,
  configHandler: ConfigHandler,
  verticalDiffManager: VerticalDiffManager,
  battery: Battery,
  quickEdit: QuickEdit,
  core: Core,
  editDecorationManager: EditDecorationManager,
) {
  for (const [command, callback] of Object.entries(
    getCommandsMap(
      ide,
      extensionContext,
      sidebar,
      configHandler,
      verticalDiffManager,
      battery,
      quickEdit,
      core,
      editDecorationManager,
    ),
  )) {
    context.subscriptions.push(
      vscode.commands.registerCommand(command, callback),
    );
  }
}
