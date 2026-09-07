import { ILLM } from "core";
import { CompletionProvider } from "core/autocomplete/CompletionProvider";
import { processSingleLineCompletion } from "core/autocomplete/util/processSingleLineCompletion";
import {
  type AutocompleteInput,
  type AutocompleteOutcome,
} from "core/autocomplete/util/types";
import { ConfigHandler } from "core/config/ConfigHandler";
import { v4 as uuidv4 } from "uuid";
import * as vscode from "vscode";

import { handleLLMError } from "../util/errorHandling";
import { PRODUCT_NAME } from "../util/extensionMeta";

import { AutocompleteSession } from "./autocompleteSession";
import {
  StatusBarStatus,
  getStatusBarStatus,
  setupStatusBar,
  stopStatusBarLoading,
} from "./statusBar";

interface VsCodeCompletionInput {
  document: vscode.TextDocument;
  position: vscode.Position;
  context: vscode.InlineCompletionContext;
}

const LIGHTWEIGHT_PREFIX_LINE_LIMIT = 96;
const LIGHTWEIGHT_SUFFIX_LINE_LIMIT = 48;
const LIGHTWEIGHT_PREFIX_CHAR_LIMIT = 16_000;
const LIGHTWEIGHT_SUFFIX_CHAR_LIMIT = 6_000;
const FIRST_RESULT_WAIT_MS = 250;

function clipPrefixContext(text: string): string {
  const lines = text.split("\n").slice(-LIGHTWEIGHT_PREFIX_LINE_LIMIT);
  const clipped = lines.join("\n");
  return clipped.length > LIGHTWEIGHT_PREFIX_CHAR_LIMIT
    ? clipped.slice(-LIGHTWEIGHT_PREFIX_CHAR_LIMIT)
    : clipped;
}

function clipSuffixContext(text: string): string {
  const lines = text.split("\n").slice(0, LIGHTWEIGHT_SUFFIX_LINE_LIMIT);
  const clipped = lines.join("\n");
  return clipped.length > LIGHTWEIGHT_SUFFIX_CHAR_LIMIT
    ? clipped.slice(0, LIGHTWEIGHT_SUFFIX_CHAR_LIMIT)
    : clipped;
}

function positionFromPrefix(prefix: string) {
  const lines = prefix.split("\n");
  return {
    line: lines.length - 1,
    character: lines[lines.length - 1]?.length ?? 0,
  };
}

function hashString(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function selectedCompletionKey(
  selectedCompletionInfo: vscode.InlineCompletionContext["selectedCompletionInfo"],
): string {
  if (!selectedCompletionInfo) {
    return "none";
  }
  const { text, range } = selectedCompletionInfo;
  return [
    hashString(text),
    range.start.line,
    range.start.character,
    range.end.line,
    range.end.character,
  ].join(":");
}

function isUsableAutocompleteModel(model: ILLM | undefined): model is ILLM {
  if (!model) {
    return false;
  }
  return !(model.providerName === "mistral" && model.apiKey === "");
}

function getPrefixWindow(
  document: vscode.TextDocument,
  end: vscode.Position,
  selectedCompletionText: string | undefined,
): string {
  const startLine = Math.max(0, end.line - LIGHTWEIGHT_PREFIX_LINE_LIMIT + 1);
  const lines: string[] = [];
  for (let line = startLine; line <= end.line; line++) {
    const lineText = document.lineAt(line).text;
    lines.push(line === end.line ? lineText.slice(0, end.character) : lineText);
  }
  return `${lines.join("\n")}${selectedCompletionText ?? ""}`;
}

function getSuffixWindow(
  document: vscode.TextDocument,
  start: vscode.Position,
): string {
  const endLine = Math.min(
    document.lineCount - 1,
    start.line + LIGHTWEIGHT_SUFFIX_LINE_LIMIT - 1,
  );
  const lines: string[] = [];
  for (let line = start.line; line <= endLine; line++) {
    const lineText = document.lineAt(line).text;
    lines.push(line === start.line ? lineText.slice(start.character) : lineText);
  }
  return lines.join("\n");
}

function stripMarkdownFence(text: string): string {
  const fenceMatch = text.match(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/);
  if (fenceMatch?.[1]) {
    return fenceMatch[1];
  }
  return text.replace(/^```[a-zA-Z0-9_-]*\n?/, "").replace(/\n?```$/, "");
}

function looksLikeProse(line: string): boolean {
  return /^(here('|’)s|here is|sure|of course|you can|i would|the code|this code|to complete|explanation|answer)\b/i.test(
    line.trim(),
  );
}

function looksLikeCode(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) {
    return false;
  }
  return /[{}()[\];=<>+\-*/]|^(const|let|var|return|if|for|while|switch|case|class|function|import|export|try|catch|await|async|def|self\.|this\.)\b/.test(
    trimmed,
  );
}

function cleanInlineCompletionText(text: string): string {
  let cleaned = stripMarkdownFence(text).replace(/\r\n/g, "\n");
  const lines = cleaned.split("\n");
  while (lines.length > 0 && looksLikeProse(lines[0] ?? "")) {
    lines.shift();
  }
  const firstCodeLine = lines.findIndex(looksLikeCode);
  if (firstCodeLine > 0 && lines.slice(0, firstCodeLine).every(looksLikeProse)) {
    lines.splice(0, firstCodeLine);
  }
  cleaned = lines.join("\n");
  return cleaned.trimEnd();
}

export class AgentCompletionProvider
  implements vscode.InlineCompletionItemProvider
{
  private static activeInstance: AgentCompletionProvider | undefined;

  public static chainAfterAcceptGlobal(): void {
    AgentCompletionProvider.activeInstance?.chainAfterAccept();
  }
  private async onError(e: unknown) {
    if (await handleLLMError(e)) {
      return;
    }
    if (
      e instanceof Error &&
      (e.message.includes("subscription") ||
        e.message.includes("ollama.com/upgrade"))
    ) {
      return;
    }
    let message = `${PRODUCT_NAME} Autocomplete Error`;
    if (e instanceof Error) {
      message += `: ${e.message}`;
    }
    vscode.window.showErrorMessage(message);
  }

  private completionProvider: CompletionProvider;

  private cachedAutocompleteModel?: {
    cacheKey: string;
    model: ILLM | undefined;
  };
  private autocompleteModelLoaded = false;
  private autocompleteSession = new AutocompleteSession();

  /** After Tab-accept: chain the next multi-line suggestion (AutoCode-style). */
  public chainAfterAccept(): void {
    this.autocompleteSession.clearOnAccept();
    this.autocompleteSession.scheduleSuggestRefresh();
  }

  /** Keep only cheap cache invalidation on edits. */
  public registerAutocompleteListeners(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        this.autocompleteSession.invalidateDocument(
          event.document.uri.toString(),
        );
      }),
    );

    context.subscriptions.push({
      dispose: () => {
        this.autocompleteSession.dispose();
      },
    });
  }

  constructor(private readonly configHandler: ConfigHandler) {
    const updateCachedAutocompleteModel = (config: any | undefined) => {
      const profileId =
        configHandler.currentProfile?.profileDescription.id ?? "";
      const selectedModels = config?.selectedModelByRole
        ? Object.values(config.selectedModelByRole)
        : [];
      const configuredModels = config?.modelsByRole
        ? Object.values(config.modelsByRole).flat()
        : [];
      const selected = [
        config?.selectedModelByRole.autocomplete,
        config?.selectedModelByRole.chat,
        config?.selectedModelByRole.edit,
        config?.selectedModelByRole.apply,
        config?.selectedModelByRole.subagent,
        ...selectedModels,
        ...(config?.modelsByRole?.autocomplete ?? []),
        ...(config?.modelsByRole?.chat ?? []),
        ...configuredModels,
      ].find(isUsableAutocompleteModel);
      const cacheKey = `${profileId}:${selected?.model ?? ""}:${selected?.title ?? "none"}`;
      this.cachedAutocompleteModel = { cacheKey, model: selected };
      this.autocompleteModelLoaded = true;
    };

    const getAutocompleteModel = async (): Promise<ILLM | undefined> => {
      if (!this.autocompleteModelLoaded) {
        const { config } = await configHandler.loadConfig();
        updateCachedAutocompleteModel(config);
      }
      return this.cachedAutocompleteModel?.model;
    };

    configHandler.onConfigUpdate(({ config }) => {
      updateCachedAutocompleteModel(config);
    });

    this.completionProvider = new CompletionProvider(
      this.configHandler,
      getAutocompleteModel,
      this.onError.bind(this),
    );

    AgentCompletionProvider.activeInstance = this;
  }

  _lastShownCompletion: AutocompleteOutcome | undefined;

  private async getRerankModel() {
    const { config } = await this.configHandler.loadConfig();
    if (!config) {
      return;
    }
    return config.selectedModelByRole.rerank ?? undefined;
  }

  /**
   * This is the entry point to tab autocomplete logic.
   * @param document The text document containing the current cursor position.
   * @param position The current cursor position.
   * @param context Contextual information about the inline completion request.
   */
  public async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken,
    //@ts-ignore
  ): ProviderResult<InlineCompletionItem[] | InlineCompletionList> {
    // This method is triggered on every keystroke, tab keypress, and cursor move.
    // We need to determine why it was triggered:
    // 1. Typing (chain doesn't exist)
    // 2. Jumping (chain exists, jump was taken)
    // 3. Accepting (chain exists, jump is not taken)

    /* START OF CONTEXT GATHERING BOILERPLATE */

    // The code in this block is meant for gathering context for autocomplete and next edit requests.
    // e.g. filepath, cursor position, editor, notebook-ness, etc.

    const enableTabAutocomplete =
      getStatusBarStatus() === StatusBarStatus.Enabled;
    if (token.isCancellationRequested || !enableTabAutocomplete) {
      return null;
    }

    if (document.uri.scheme === "vscode-scm") {
      return null;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return undefined;
    }
    // Don't autocomplete with multi-cursor
    if (editor && editor.selections.length > 1) {
      return null;
    }

    const selectedCompletionInfo = context.selectedCompletionInfo;

    // This code checks if there is a selected completion suggestion in the given context and ensures that it is valid
    // To improve the accuracy of suggestions it checks if the user has typed at least 4 characters
    // This helps refine and filter out irrelevant autocomplete options
    if (selectedCompletionInfo) {
      const { text, range } = selectedCompletionInfo;
      const typedText = document.getText(range);

      const typedLength = range.end.character - range.start.character;

      if (typedLength < 1) {
        return null;
      }

      if (!text.startsWith(typedText)) {
        return null;
      }
    }

    return this.provideTabAutocompleteOnly(
      document,
      position,
      context,
      token,
      editor,
      selectedCompletionInfo,
    );
  }

  /**
   * Tab autocomplete with AutoCode-style fast paths: typing fast-forward,
   * background fetch + inlineSuggest re-trigger, and streaming partial updates.
   */
  private async provideTabAutocompleteOnly(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.InlineCompletionContext,
    _token: vscode.CancellationToken,
    _editor: vscode.TextEditor,
    selectedCompletionInfo: vscode.InlineCompletionContext["selectedCompletionInfo"],
  ): Promise<vscode.InlineCompletionItem[] | null | undefined> {
    const linePrefix = document.lineAt(position.line).text.substring(
      0,
      position.character,
    );
    const uri = document.uri.toString();
    const suffixPreview = getSuffixWindow(document, position);
    const fetchKey = this.autocompleteSession.positionKey(
      uri,
      document.version,
      position,
      linePrefix,
      hashString(suffixPreview),
      selectedCompletionKey(selectedCompletionInfo),
    );

    const fastForward = this.autocompleteSession.tryTypingFastForward(
      document,
      position,
    );
    if (fastForward !== null) {
      this.autocompleteSession.notePosition(position);
      return this.renderCompletionText(
        document,
        position,
        selectedCompletionInfo,
        fastForward,
        this.autocompleteSession.getActiveCompletionId() ?? uuidv4(),
      );
    }

    this.autocompleteSession.notePosition(position);

    const l1 = this.autocompleteSession.getL1(fetchKey, document.version);
    if (l1?.completion) {
      return this.renderAutocompleteOutcome(
        document,
        position,
        selectedCompletionInfo,
        l1,
        new AbortController().signal,
        l1.completionId,
      );
    }

    const prefetched = this.autocompleteSession.getPrefetch(fetchKey);
    if (prefetched?.completion) {
      return this.renderAutocompleteOutcome(
        document,
        position,
        selectedCompletionInfo,
        prefetched,
        new AbortController().signal,
        prefetched.completionId,
      );
    }

    const input = this.buildAutocompleteInput(
      document,
      position,
      selectedCompletionInfo,
    );
    const compatiblePrefetch = this.autocompleteSession.getCompatiblePrefetch(
      uri,
      document.version,
      input.manuallyPassPrefix ?? linePrefix,
    );
    if (compatiblePrefetch?.completion) {
      return this.renderAutocompleteOutcome(
        document,
        position,
        selectedCompletionInfo,
        compatiblePrefetch,
        new AbortController().signal,
        compatiblePrefetch.completionId,
      );
    }

    const partial = this.autocompleteSession.getPartial(fetchKey);
    if (partial) {
      return this.renderCompletionText(
        document,
        position,
        selectedCompletionInfo,
        partial,
        this.autocompleteSession.getPartialCompletionId(fetchKey) ??
          uuidv4(),
      );
    }

    const { signal: llmSignal, isOwner } =
      this.autocompleteSession.beginFetch(fetchKey, true);

    if (isOwner) {
      const fetchPromise = this.triggerTabAutocompleteBackgroundFetch(
        document,
        position,
        selectedCompletionInfo,
        fetchKey,
        input,
        llmSignal,
      );

      const immediateOutcome = await Promise.race([
        fetchPromise,
        new Promise<AutocompleteOutcome | undefined>((resolve) =>
          setTimeout(() => resolve(undefined), FIRST_RESULT_WAIT_MS),
        ),
      ]);

      if (immediateOutcome?.completion && !llmSignal.aborted) {
        return this.renderAutocompleteOutcome(
          document,
          position,
          selectedCompletionInfo,
          immediateOutcome,
          llmSignal,
          immediateOutcome.completionId,
        );
      }
    }

    // Return immediately; partial/final completions arrive via scheduleSuggestRefresh.
    return null;
  }

  private async triggerTabAutocompleteBackgroundFetch(
    document: vscode.TextDocument,
    position: vscode.Position,
    selectedCompletionInfo: vscode.InlineCompletionContext["selectedCompletionInfo"],
    fetchKey: string,
    input: AutocompleteInput,
    llmSignal: AbortSignal,
  ): Promise<AutocompleteOutcome | undefined> {
    try {
      setupStatusBar(undefined, true);

      const outcome =
        await this.completionProvider.provideLightweightInlineCompletionItems(
          input,
          llmSignal,
          true,
          {
            onPartial: (completion) => {
              if (llmSignal.aborted || !completion) {
                return;
              }
              const displayCompletion = this.toDisplayCompletion(
                selectedCompletionInfo,
                completion,
              );
              if (displayCompletion.trim().length === 0) {
                return;
              }
              this.autocompleteSession.setPartial(
                fetchKey,
                displayCompletion,
                input.completionId,
              );
              this.autocompleteSession.scheduleSuggestRefresh();
            },
          },
        );

      if (llmSignal.aborted) {
        return undefined;
      }

      if (outcome?.completion) {
        this.autocompleteSession.setPrefetch(
          fetchKey,
          outcome,
          document.version,
        );
        this.autocompleteSession.scheduleSuggestRefresh();
        return outcome;
      }
      return undefined;
    } catch (e) {
      console.warn("Tab autocomplete background fetch failed:", e);
      return undefined;
    } finally {
      this.autocompleteSession.endFetch(fetchKey);
      stopStatusBarLoading();
    }
  }

  private buildAutocompleteInput(
    document: vscode.TextDocument,
    position: vscode.Position,
    selectedCompletionInfo: vscode.InlineCompletionContext["selectedCompletionInfo"],
  ): AutocompleteInput {
    const prefixEnd = selectedCompletionInfo?.range.start ?? position;
    const rawPrefix = getPrefixWindow(
      document,
      prefixEnd,
      selectedCompletionInfo?.text,
    );
    const rawSuffix = getSuffixWindow(document, position);
    const manuallyPassPrefix = clipPrefixContext(rawPrefix);
    const manuallyPassSuffix = clipSuffixContext(rawSuffix);

    return {
      completionId: uuidv4(),
      filepath: document.uri.toString(),
      pos: positionFromPrefix(manuallyPassPrefix),
      isUntitledFile: document.isUntitled,
      manuallyPassFileContents: manuallyPassPrefix + manuallyPassSuffix,
      manuallyPassPrefix,
      manuallyPassSuffix,
      selectedCompletionInfo,
    };
  }

  private renderAutocompleteOutcome(
    document: vscode.TextDocument,
    position: vscode.Position,
    selectedCompletionInfo: vscode.InlineCompletionContext["selectedCompletionInfo"],
    outcome: AutocompleteOutcome,
    abortSignal: AbortSignal,
    completionId: string,
  ): vscode.InlineCompletionItem[] | null | undefined {
    const displayCompletion = this.toDisplayCompletion(
      selectedCompletionInfo,
      outcome.completion,
    );
    const displayOutcome = { ...outcome, completion: displayCompletion };

    if (!this.willDisplay(document, selectedCompletionInfo, abortSignal, displayOutcome)) {
      return null;
    }

    this.completionProvider.markDisplayed(completionId, displayOutcome);
    this._lastShownCompletion = displayOutcome;
    this.autocompleteSession.setCurrentCompletion(displayCompletion);

    return this.renderCompletionText(
      document,
      position,
      selectedCompletionInfo,
      displayCompletion,
      completionId,
    );
  }

  private toDisplayCompletion(
    selectedCompletionInfo: vscode.InlineCompletionContext["selectedCompletionInfo"],
    completionText: string,
  ): string {
    if (!selectedCompletionInfo || completionText.startsWith(selectedCompletionInfo.text)) {
      return completionText;
    }
    return `${selectedCompletionInfo.text}${completionText}`;
  }

  private renderCompletionText(
    document: vscode.TextDocument,
    position: vscode.Position,
    selectedCompletionInfo: vscode.InlineCompletionContext["selectedCompletionInfo"],
    completionText: string,
    completionId: string,
  ): vscode.InlineCompletionItem[] | null | undefined {
    if (!completionText) {
      return null;
    }
    completionText = this.toDisplayCompletion(selectedCompletionInfo, completionText);
    completionText = cleanInlineCompletionText(completionText);
    if (!completionText.trim()) {
      return null;
    }

    const startPos = selectedCompletionInfo?.range.start ?? position;
    let range = new vscode.Range(startPos, startPos);

    const isSingleLineCompletion = completionText.split("\n").length <= 1;

    if (isSingleLineCompletion) {
      const lastLineOfCompletionText =
        completionText.split("\n").pop() || "";
      const currentText = document
        .lineAt(startPos)
        .text.substring(startPos.character);

      const result = processSingleLineCompletion(
        lastLineOfCompletionText,
        currentText,
        startPos.character,
      );

      if (result === undefined) {
        // Fall back to raw model output rather than showing nothing.
        completionText = lastLineOfCompletionText;
      } else {
        completionText = result.completionText;
      }

      if (result?.range) {
        range = new vscode.Range(
          new vscode.Position(startPos.line, result.range.start),
          new vscode.Position(startPos.line, result.range.end),
        );
      }
    } else {
      range = new vscode.Range(
        startPos,
        document.lineAt(startPos).range.end,
      );
    }

    const item = new vscode.InlineCompletionItem(completionText, range, {
      title: "Accept Autocomplete",
      command: "agent.logAutocompleteOutcome",
      arguments: [completionId, this.completionProvider],
    });

    (item as any).completeBracketPairs = true;
    return [item];
  }

  willDisplay(
    document: vscode.TextDocument,
    selectedCompletionInfo: vscode.SelectedCompletionInfo | undefined,
    abortSignal: AbortSignal,
    outcome: AutocompleteOutcome,
  ): boolean {
    if (selectedCompletionInfo) {
      const { text, range } = selectedCompletionInfo;
      if (!outcome.completion.startsWith(text)) {
        // console.debug(
        //   `Won't display completion because text doesn't match: ${text}, ${outcome.completion}`,
        //   range,
        // );
        return false;
      }
    }

    if (abortSignal.aborted) {
      return false;
    }

    return true;
  }
}
