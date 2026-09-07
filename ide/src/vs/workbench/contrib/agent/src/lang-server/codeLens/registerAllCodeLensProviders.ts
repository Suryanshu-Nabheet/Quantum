import * as vscode from "vscode";

import { VerticalDiffCodeLens } from "../../diff/vertical/manager";

import * as providers from "./providers";

const { registerCodeLensProvider } = vscode.languages;

let verticalPerLineCodeLensProvider: vscode.Disposable | undefined =
  undefined;

/**
 * Registers all CodeLens providers for Agent.
 *
 * This function disposes of any existing CodeLens providers and registers
 * vertical per-line diff actions.
 *
 * @param context - The Agent runtime context
 * @param editorToVerticalDiffCodeLens - A Map of editor IDs to VerticalDiffCodeLens arrays
 *
 * @returns An object containing the verticalDiffCodeLens provider
 */
export function registerAllCodeLensProviders(
  context: vscode.ExtensionContext,
  editorToVerticalDiffCodeLens: Map<string, VerticalDiffCodeLens[]>,
) {
  if (verticalPerLineCodeLensProvider) {
    verticalPerLineCodeLensProvider.dispose();
  }

  const verticalDiffCodeLens = new providers.VerticalPerLineCodeLensProvider(
    editorToVerticalDiffCodeLens,
  );

  verticalPerLineCodeLensProvider = registerCodeLensProvider(
    "*",
    verticalDiffCodeLens,
  );

  context.subscriptions.push(verticalPerLineCodeLensProvider);

  return { verticalDiffCodeLens };
}
