import * as fs from "node:fs";
import * as path from "node:path";

import { IContextProvider } from "core";
import { ConfigHandler } from "core/config/ConfigHandler";
import { Core } from "core/core";
import { FromCoreProtocol, ToCoreProtocol } from "core/protocol";
import { InProcessMessenger } from "core/protocol/messenger";
import {
  getAgentGlobalPath,
  getSharedConfigFilePath,
} from "core/util/paths";
import { v4 as uuidv4 } from "uuid";
import * as vscode from "vscode";

import { AgentGUIWebviewViewProvider } from "../AgentGUIWebviewViewProvider";
import { AgentCompletionProvider } from "../autocomplete/completionProvider";
import {
  monitorBatteryChanges,
  setupStatusBar,
  StatusBarStatus,
} from "../autocomplete/statusBar";
import { registerAllCommands } from "../commands";
import { VerticalDiffManager } from "../diff/vertical/manager";
import { registerAllCodeLensProviders } from "../lang-server/codeLens/registerAllCodeLensProviders";
import EditDecorationManager from "../quickEdit/EditDecorationManager";
import { QuickEdit } from "../quickEdit/QuickEditQuickPick";
import { UriEventHandler } from "../stubs/uriHandler";
import { Battery } from "../util/battery";
import { FileSearch } from "../util/FileSearch";
import { EXTENSION_NAME } from "../util/constants";
import {
  clearDocumentContentCache,
  handleTextDocumentChange,
  initDocumentContentCache,
} from "../util/editLoggingUtils";
import { VsCodeIde } from "../VsCodeIde";
import type { VsCodeWebviewProtocol } from "../webviewProtocol";

import { VsCodeMessenger } from "./VsCodeMessenger";

export class VsCodeExtension {
  private readonly configHandler: ConfigHandler;
  private readonly extensionContext: vscode.ExtensionContext;
  private readonly ide: VsCodeIde;
  private readonly sidebar: AgentGUIWebviewViewProvider;
  private readonly windowId: string;
  private readonly editDecorationManager: EditDecorationManager;
  private readonly verticalDiffManager: VerticalDiffManager;
  private readonly webviewProtocolPromise: Promise<VsCodeWebviewProtocol>;
  private readonly core: Core;
  private readonly battery: Battery;
  private readonly fileSearch: FileSearch;
  private readonly completionProvider?: AgentCompletionProvider;
  private readonly uriHandler = new UriEventHandler();
  private runtimeStarted = false;

  static agentVirtualDocumentScheme = EXTENSION_NAME;

  constructor(context: vscode.ExtensionContext) {
    this.editDecorationManager = new EditDecorationManager(context);
    this.extensionContext = context;
    this.windowId = uuidv4();

    let resolveWebviewProtocol: (value: VsCodeWebviewProtocol) => void =
      () => {};
    this.webviewProtocolPromise = new Promise((resolve) => {
      resolveWebviewProtocol = resolve;
    });

    this.ide = new VsCodeIde(this.webviewProtocolPromise, context);

    let resolveVerticalDiffManager: (value: VerticalDiffManager) => void =
      () => {};
    const verticalDiffManagerPromise = new Promise<VerticalDiffManager>(
      (resolve) => {
        resolveVerticalDiffManager = resolve;
      },
    );

    let resolveConfigHandler: (value: ConfigHandler) => void = () => {};
    const configHandlerPromise = new Promise<ConfigHandler>((resolve) => {
      resolveConfigHandler = resolve;
    });

    this.sidebar = new AgentGUIWebviewViewProvider(
      this.windowId,
      this.extensionContext,
      () => void this.ensureRuntime("sidebar resolved"),
    );

    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        AgentGUIWebviewViewProvider.viewType,
        this.sidebar,
      ),
    );
    resolveWebviewProtocol(this.sidebar.webviewProtocol);

    const inProcessMessenger = new InProcessMessenger<
      ToCoreProtocol,
      FromCoreProtocol
    >();

    new VsCodeMessenger(
      inProcessMessenger,
      this.sidebar.webviewProtocol,
      this.ide,
      verticalDiffManagerPromise,
      configHandlerPromise,
      this.editDecorationManager,
      context,
      this,
    );

    this.core = new Core(inProcessMessenger, this.ide);
    this.configHandler = this.core.configHandler;
    resolveConfigHandler(this.configHandler);

    this.verticalDiffManager = new VerticalDiffManager(
      this.sidebar.webviewProtocol,
      this.editDecorationManager,
      this.ide,
    );
    resolveVerticalDiffManager(this.verticalDiffManager);

    const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
    const enabled = config.get<boolean>("enableTabAutocomplete", true);

    setupStatusBar(
      enabled ? StatusBarStatus.Enabled : StatusBarStatus.Disabled,
    );
    this.completionProvider = new AgentCompletionProvider(this.configHandler);
    this.completionProvider.registerAutocompleteListeners(context);
    context.subscriptions.push(
      vscode.languages.registerInlineCompletionItemProvider(
        [{ pattern: "**" }],
        this.completionProvider,
      ),
    );

    this.uriHandler.event((uri) => {
      const queryParams = new URLSearchParams(uri.query);
      const profileId = queryParams.get("profile_id");

      this.core.invoke("config/refreshProfiles", {
        reason: "VS Code deep link",
        selectProfileId:
          profileId === "null" ? undefined : (profileId ?? undefined),
      });
    });

    this.battery = new Battery();
    context.subscriptions.push(this.battery);
    context.subscriptions.push(monitorBatteryChanges(this.battery));

    this.fileSearch = new FileSearch(this.ide);

    const quickEdit = new QuickEdit(
      this.verticalDiffManager,
      this.configHandler,
      this.sidebar.webviewProtocol,
      this.ide,
      context,
      this.fileSearch,
    );

    registerAllCommands(
      context,
      this.ide,
      context,
      this.sidebar,
      this.configHandler,
      this.verticalDiffManager,
      this.battery,
      quickEdit,
      this.core,
      this.editDecorationManager,
    );

    const documentContentProvider = new (class
      implements vscode.TextDocumentContentProvider
    {
      onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
      onDidChange = this.onDidChangeEmitter.event;

      provideTextDocumentContent(uri: vscode.Uri): string {
        return uri.query;
      }
    })();
    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider(
        VsCodeExtension.agentVirtualDocumentScheme,
        documentContentProvider,
      ),
    );

  }

  private async ensureRuntime(reason: string): Promise<void> {
    if (this.runtimeStarted) {
      return;
    }
    this.runtimeStarted = true;
    const context = this.extensionContext;

    await this.configHandler.loadConfig();
    const { verticalDiffCodeLens } = registerAllCodeLensProviders(
      context,
      this.verticalDiffManager.fileUriToCodeLens,
    );
    this.verticalDiffManager.refreshCodeLens =
      verticalDiffCodeLens.refresh.bind(verticalDiffCodeLens);

    this.configHandler.onConfigUpdate(
      async ({ config: newConfig, configLoadInterrupted }) => {
        if (configLoadInterrupted) {
          setupStatusBar(undefined, undefined, true);
        } else if (newConfig) {
          setupStatusBar(undefined, undefined, false);

          registerAllCodeLensProviders(
            context,
            this.verticalDiffManager.fileUriToCodeLens,
          );
        }
      },
    );

    this.watchSharedConfig();

    context.subscriptions.push(
      vscode.workspace.onDidOpenTextDocument((document) => {
        initDocumentContentCache(document);
      }),
    );

    context.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument(async (event) => {
        await handleTextDocumentChange(event);
      }),
    );

    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument((event) => {
        this.core.invoke("files/changed", {
          uris: [event.uri.toString()],
        });
      }),
    );

    context.subscriptions.push(
      vscode.workspace.onDidDeleteFiles((event) => {
        this.core.invoke("files/deleted", {
          uris: event.files.map((uri) => uri.toString()),
        });
      }),
    );

    context.subscriptions.push(
      vscode.workspace.onDidCloseTextDocument((event) => {
        clearDocumentContentCache(event.uri.toString());
        this.core.invoke("files/closed", {
          uris: [event.uri.toString()],
        });
      }),
    );

    context.subscriptions.push(
      vscode.workspace.onDidCreateFiles((event) => {
        this.core.invoke("files/created", {
          uris: event.files.map((uri) => uri.toString()),
        });
      }),
    );

    context.subscriptions.push(
      vscode.workspace.onDidChangeWorkspaceFolders((event) => {
        const dirs = vscode.workspace.workspaceFolders?.map(
          (folder) => folder.uri,
        );

        this.ide.ideUtils.setWokspaceDirectories(dirs);
      }),
    );

    context.subscriptions.push(
      vscode.authentication.onDidChangeSessions(async (e) => {
        if (e.provider.id === "github") {
          void this.configHandler.reloadConfig("Github sign-in status changed");
        }
      }),
    );

    this.ide.onDidChangeActiveTextEditor((filepath) => {
      void this.core.invoke("files/opened", { uris: [filepath] });
    });

    const initialOpenedFilePaths = this.ide.ideUtils
      .getOpenFiles()
      .map((uri) => uri.toString());
    this.core.invoke("files/opened", { uris: initialOpenedFilePaths });

    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(async (event) => {
        if (event.affectsConfiguration(EXTENSION_NAME)) {
          const settings = await this.ide.getIdeSettings();
          void this.core.invoke("config/ideSettingsUpdate", settings);
        }
      }),
    );

    console.debug(`Agent runtime initialized: ${reason}`);
  }

  private watchSharedConfig(): void {
    const sharedConfigPath = getSharedConfigFilePath();
    if (fs.existsSync(sharedConfigPath)) {
      fs.watchFile(sharedConfigPath, { interval: 1000 }, async (stats) => {
        if (stats.size === 0) {
          return;
        }
        await this.configHandler.reloadConfig(
          "Shared config updated - fs file watch",
        );
      });
    }

    const globalRulesDir = path.join(getAgentGlobalPath(), "rules");
    if (fs.existsSync(globalRulesDir)) {
      fs.watch(globalRulesDir, { recursive: true }, (eventType, filename) => {
        if (filename && filename.toString().endsWith(".md")) {
          void this.configHandler.reloadConfig(
            "Global rules directory updated - fs file watch",
          );
        }
      });
    }
  }

  registerCustomContextProvider(contextProvider: IContextProvider) {
    this.configHandler.registerCustomContextProvider(contextProvider);
  }

  dispose(): void {
    while (this.extensionContext.subscriptions.length > 0) {
      const disposable = this.extensionContext.subscriptions.pop();
      disposable?.dispose();
    }
  }
}
