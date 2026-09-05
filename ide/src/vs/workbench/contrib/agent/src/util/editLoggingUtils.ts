import * as vscode from "vscode";

const documentContentCache = new Map<string, string>();

const updateDocumentContentCache = (
  document: vscode.TextDocument,
): void => {
  documentContentCache.set(document.uri.toString(), document.getText());
};

export const initDocumentContentCache = (
  document: vscode.TextDocument,
): void => {
  documentContentCache.set(document.uri.toString(), document.getText());
};

export const clearDocumentContentCache = (uri: string): void => {
  documentContentCache.delete(uri);
};

export const handleTextDocumentChange = async (
  event: vscode.TextDocumentChangeEvent,
): Promise<void> => {
  if (event.contentChanges.length === 0) {
    return;
  }
  updateDocumentContentCache(event.document);
};
