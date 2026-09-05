import * as fs from "fs";
import * as path from "path";

import * as vscode from "vscode";

import { getExtensionUri } from "./vscode";
import { isBuiltinQuantumAgent } from "./quantumIntegration";

/**
 * Extension Development Host only: load the GUI from Vite at localhost:5173 so
 * `npm run dev` (gui) hot-reloads without rebuilding out/agent/webview/.
 *
 * - true: use Vite (live HMR during GUI development).
 * - false or unset: use bundled webview assets when they exist (default after
 *   repo-root `npm run watch`). Falls back to Vite only when webview assets are missing.
 */
const VITE_DEV_SERVER_ORIGIN = "http://localhost:5173";

function bundledGuiAssetsExist(extensionUri: vscode.Uri): boolean {
  const assetsDir = path.join(extensionUri.fsPath, "webview", "assets");
  return [
    "index.js",
    "index.css",
  ].every((asset) => fs.existsSync(path.join(assetsDir, asset)));
}

/** Some development hosts do not set ExtensionMode.Development. */
function isGuiDevelopmentContext(
  context: vscode.ExtensionContext | undefined,
): boolean {
  if (!context) {
    return false;
  }
  if (context.extensionMode === vscode.ExtensionMode.Development) {
    return true;
  }

  const normalized = context.extensionPath.replace(/\\/g, "/");
  const isInstalledExtension =
    normalized.includes("/.vscode/extensions/") ||
    normalized.includes("/.quantum/extensions/") ||
    normalized.includes("/.cursor/extensions/");

  return !isInstalledExtension;
}

function shouldUseViteGuiDevServer(
  context: vscode.ExtensionContext | undefined,
): boolean {
  // Built into Quantum from generated out/agent — never load localhost UI.
  if (context && isBuiltinQuantumAgent(context)) {
    return false;
  }

  const configured = vscode.workspace
    .getConfiguration("agent")
    .get<boolean | null>("useViteGuiDevServer");

  if (configured === true) {
    return isGuiDevelopmentContext(context);
  }

  const extensionUri = getExtensionUri();
  const hasBundledGui = bundledGuiAssetsExist(extensionUri);

  if (!isGuiDevelopmentContext(context)) {
    return false;
  }

  if (configured === false || hasBundledGui) {
    return false;
  }

  // No bundled webview yet — fall back to Vite dev server.
  return true;
}

/** Base URL for static GUI assets (provider logos, fonts). */
export function resolveGuiMediaBaseUrl(
  context: vscode.ExtensionContext | undefined,
  panel: vscode.WebviewPanel | vscode.WebviewView,
): string {
  if (shouldUseViteGuiDevServer(context)) {
    return VITE_DEV_SERVER_ORIGIN;
  }
  const extensionUri = getExtensionUri();
  return panel.webview
    .asWebviewUri(vscode.Uri.joinPath(extensionUri, "webview"))
    .toString();
}

export function getGuiLocalResourceRoots(
  extensionUri: vscode.Uri,
): vscode.Uri[] {
  return [extensionUri, vscode.Uri.joinPath(extensionUri, "webview")];
}

export function resolveGuiScriptAndStyle(
  context: vscode.ExtensionContext | undefined,
  panel: vscode.WebviewPanel | vscode.WebviewView,
): { scriptUri: string; styleMainUri: string; useViteDevServer: boolean } {
  const useViteDevServer = shouldUseViteGuiDevServer(context);
  const extensionUri = getExtensionUri();

  if (useViteDevServer) {
    return {
      scriptUri: "http://localhost:5173/src/main.tsx",
      styleMainUri: "http://localhost:5173/src/index.css",
      useViteDevServer: true,
    };
  }

  return {
    scriptUri: panel.webview
      .asWebviewUri(vscode.Uri.joinPath(extensionUri, "webview/assets/index.js"))
      .toString(),
    styleMainUri: panel.webview
      .asWebviewUri(vscode.Uri.joinPath(extensionUri, "webview/assets/index.css"))
      .toString(),
    useViteDevServer: false,
  };
}

export function reactRefreshScript(nonce: string): string {
  return `<script type="module" nonce="${nonce}">
          import RefreshRuntime from "http://localhost:5173/@react-refresh"
          RefreshRuntime.injectIntoGlobalHook(window)
          window.$RefreshReg$ = () => {}
          window.$RefreshSig$ = () => (type) => type
          window.__vite_plugin_react_preamble_installed__ = true
          </script>`;
}

export function guiContentSecurityPolicy(
  panel: vscode.WebviewPanel | vscode.WebviewView,
  nonce: string,
  useViteDevServer: boolean,
): string {
  const csp = panel.webview.cspSource;
  if (useViteDevServer) {
    return (
      `script-src 'nonce-${nonce}' ${csp} 'unsafe-eval' http://localhost:5173; ` +
      `style-src 'unsafe-inline' ${csp} http://localhost:5173; ` +
      `connect-src http://localhost:5173 ws://localhost:5173 http://0.0.0.0:5173 ws://0.0.0.0:5173; ` +
      `img-src ${csp} https: http: data: blob:; font-src ${csp} data:;`
    );
  }
  return (
    `script-src 'nonce-${nonce}' ${csp} 'unsafe-eval'; ` +
    `style-src 'unsafe-inline' ${csp}; ` +
    `img-src ${csp} https: http: data: blob:; font-src ${csp} data:;`
  );
}
