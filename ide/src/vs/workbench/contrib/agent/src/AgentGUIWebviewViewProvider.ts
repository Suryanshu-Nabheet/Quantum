import * as vscode from "vscode";

import { PRODUCT_NAME } from "./util/extensionMeta";
import { getTheme } from "./util/getTheme";
import {
  getGuiLocalResourceRoots,
  guiContentSecurityPolicy,
  reactRefreshScript,
  resolveGuiMediaBaseUrl,
  resolveGuiScriptAndStyle,
} from "./util/guiAssets";
import { getExtensionVersion, getvsCodeUriScheme } from "./util/util";
import { getExtensionUri, getNonce } from "./util/vscode";
import { VsCodeWebviewProtocol } from "./webviewProtocol";

import type { FileEdit } from "core";

export class AgentGUIWebviewViewProvider
  implements vscode.WebviewViewProvider {
  public static readonly viewType = "agent.agentGUIView";
  public webviewProtocol: VsCodeWebviewProtocol;

  public get isReady(): boolean {
    return !!this.webview;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void | Thenable<void> {
    this.webviewProtocol.webview = webviewView.webview;
    this._webviewView = webviewView;
    this._webview = webviewView.webview;
    webviewView.onDidDispose(() => {
      this.webviewProtocol.removeWebview(webviewView.webview);
      this._webview = undefined;
      this._webviewView = undefined;
    });
    webviewView.webview.html = this.getSidebarContent(
      this.extensionContext,
      webviewView,
    );
    this.onResolve?.();
  }

  private _webview?: vscode.Webview;
  private _webviewView?: vscode.WebviewView;

  get isVisible() {
    return this._webviewView?.visible;
  }

  get webview() {
    return this._webview;
  }

  public resetWebviewProtocolWebview(): void {
    if (!this._webview) {
      console.warn("no webview found during reset");
      return;
    }
    this.webviewProtocol.webview = this._webview;
  }

  sendMainUserInput(input: string) {
    this.webview?.postMessage({
      type: "userInput",
      input,
    });
  }

  constructor(
    private readonly windowId: string,
    private readonly extensionContext: vscode.ExtensionContext,
    private readonly onResolve?: () => void,
  ) {
    this.webviewProtocol = new VsCodeWebviewProtocol();

    extensionContext.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (
          e.affectsConfiguration("workbench.colorTheme") ||
          e.affectsConfiguration("window.autoDetectColorScheme") ||
          e.affectsConfiguration("window.autoDetectHighContrast") ||
          e.affectsConfiguration("workbench.preferredDarkColorTheme") ||
          e.affectsConfiguration("workbench.preferredLightColorTheme") ||
          e.affectsConfiguration("workbench.preferredHighContrastColorTheme") ||
          e.affectsConfiguration(
            "workbench.preferredHighContrastLightColorTheme",
          )
        ) {
          void this.webviewProtocol?.request("setTheme", {
            theme: getTheme(),
          });
        }
      }),
    );
  }

  getSidebarContent(
    context: vscode.ExtensionContext | undefined,
    panel: vscode.WebviewPanel | vscode.WebviewView,
    page: string | undefined = undefined,
    edits: FileEdit[] | undefined = undefined,
    isFullScreen = false,
  ): string {
    const extensionUri = getExtensionUri();
    const { scriptUri, styleMainUri, useViteDevServer } =
      resolveGuiScriptAndStyle(context, panel);
    const vscMediaUrl = resolveGuiMediaBaseUrl(context, panel);

    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: getGuiLocalResourceRoots(extensionUri),
      enableCommandUris: true,
      portMapping: [
        {
          webviewPort: 65433,
          extensionHostPort: 65433,
        },
      ],
    };

    const nonce = getNonce();

    const currentTheme = getTheme();
    const workbenchHoverDelay = vscode.workspace
      .getConfiguration("workbench.hover")
      .get<number>("delay", 500);

    this.webviewProtocol.webview = panel.webview;

    return `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <base href="${vscMediaUrl.endsWith("/") ? vscMediaUrl : `${vscMediaUrl}/`}">
        <meta http-equiv="Content-Security-Policy" content="${guiContentSecurityPolicy(panel, nonce, useViteDevServer)}">
        <script nonce="${nonce}">const vscode = acquireVsCodeApi();</script>
        <link href="${styleMainUri}" rel="stylesheet">

        <title>${PRODUCT_NAME}</title>
      </head>
      <body class="${isFullScreen ? "full-screen" : "sidebar"}">
        <div id="root"></div>

        ${useViteDevServer ? reactRefreshScript(nonce) : ""}

        <script type="module" nonce="${nonce}" src="${scriptUri}"></script>

        <script nonce="${nonce}">localStorage.setItem("ide", '"vscode"')</script>
        <script nonce="${nonce}">localStorage.setItem("vsCodeUriScheme", '"${getvsCodeUriScheme()}"')</script>
        <script nonce="${nonce}">localStorage.setItem("extensionVersion", '"${getExtensionVersion()}"')</script>
        <script nonce="${nonce}">window.windowId = "${this.windowId}"</script>
        <script nonce="${nonce}">window.vscMediaUrl = "${vscMediaUrl}"</script>
        <script nonce="${nonce}">window.ide = "vscode"</script>
        <script nonce="${nonce}">window.fullColorTheme = ${JSON.stringify(currentTheme)}</script>
        <script nonce="${nonce}">window.workbenchHoverDelay = ${workbenchHoverDelay}</script>
        <script nonce="${nonce}">window.colorThemeName = "dark-plus"</script>
        <script nonce="${nonce}">window.workspacePaths = ${JSON.stringify(
      vscode.workspace.workspaceFolders?.map((folder) =>
        folder.uri.toString(),
      ) || [],
    )}</script>
        <script nonce="${nonce}">window.isFullScreen = ${isFullScreen}</script>

        ${edits
        ? `<script nonce="${nonce}">window.edits = ${JSON.stringify(
          edits,
        )}</script>`
        : ""
      }
        ${page
        ? `<script nonce="${nonce}">window.initialRoute = "${page}"</script>`
        : ""
      }
      </body>
    </html>`;
  }
}
