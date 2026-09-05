import * as path from "path";

import * as URI from "uri-js";
import * as vscode from "vscode";

export function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

import { EXTENSION_ID } from "./extensionMeta";

export function getExtensionUri(): vscode.Uri {
  const extension = vscode.extensions.getExtension(EXTENSION_ID);
  if (!extension) {
    // Fallback if the extension isn't found by the full ID yet
    return vscode.Uri.file(__dirname).with({ path: path.join(__dirname, "..") });
  }
  return extension.extensionUri;
}

function getViewColumnOfFile(
  uri: vscode.Uri,
): vscode.ViewColumn | undefined {
  for (const tabGroup of vscode.window.tabGroups.all) {
    for (const tab of tabGroup.tabs) {
      if (
        (tab?.input as any)?.uri &&
        URI.equal((tab.input as any).uri, uri.toString())
      ) {
        return tabGroup.viewColumn;
      }
    }
  }
  return undefined;
}

let showTextDocumentInProcess = false;

export function openEditorAndRevealRange(
  uri: vscode.Uri,
  range?: vscode.Range,
  viewColumn?: vscode.ViewColumn,
  preview?: boolean,
): Promise<vscode.TextEditor> {
  return new Promise((resolve, reject) => {
    void (async () => {
      try {
        const doc = await vscode.workspace.openTextDocument(uri);
        // An error is thrown mysteriously if you open two documents in parallel, hence this
        while (showTextDocumentInProcess) {
          await new Promise<void>((done) => setTimeout(done, 200));
        }
        showTextDocumentInProcess = true;
        const editor = await vscode.window.showTextDocument(doc, {
          viewColumn: getViewColumnOfFile(uri) || viewColumn,
          preview,
        });
        if (range) {
          editor.revealRange(range);
        }
        resolve(editor);
      } catch (err) {
        reject(err);
      } finally {
        showTextDocumentInProcess = false;
      }
    })();
  });
}

export function getUniqueId() {
  return vscode.env.machineId;
}
