import { AutocompleteOutcome } from "core/autocomplete/util/types";
import * as vscode from "vscode";


import { AutocompletePositionCache } from "./AutocompletePositionCache";
import { getStatusBarStatus, StatusBarStatus } from "./statusBar";

const SUGGEST_REFRESH_MS = 16;

type FetchHandle = {
  signal: AbortSignal;
  /** Only the owner should call endFetch — coalesced callers share the same signal. */
  isOwner: boolean;
};

export class AutocompleteSession {
  private currentCompletion: string | null = null;
  private acceptedOffset = 0;
  private lastPosition: vscode.Position | null = null;

  private prefetchResult: {
    key: string;
    outcome: AutocompleteOutcome;
  } | null = null;

  private partialResult: {
    key: string;
    completion: string;
    completionId: string;
  } | null = null;

  private activeCompletionId: string | null = null;

  private inFlightFetches = new Map<string, AbortController>();
  private suggestRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private positionCache = new AutocompletePositionCache();

  positionKey(
    uri: string,
    documentVersion: number,
    position: vscode.Position,
    linePrefix: string,
    suffixKey: string,
    selectedCompletionKey: string,
  ): string {
    return [
      uri,
      documentVersion,
      position.line,
      position.character,
      linePrefix,
      suffixKey,
      selectedCompletionKey,
    ].join(":");
  }

  tryTypingFastForward(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): string | null {
    if (!this.lastPosition || !this.currentCompletion) {
      return null;
    }

    if (position.line !== this.lastPosition.line) {
      this.clearCurrentCompletion();
      return null;
    }

    if (position.character <= this.lastPosition.character) {
      this.clearCurrentCompletion();
      return null;
    }

    const lineText = document.lineAt(position.line).text;
    const typedText = lineText.substring(
      this.lastPosition.character,
      position.character,
    );
    const remaining = this.currentCompletion.substring(this.acceptedOffset);

    if (!remaining.startsWith(typedText)) {
      this.clearCurrentCompletion();
      return null;
    }

    this.acceptedOffset += typedText.length;
    this.lastPosition = position;

    const newRemaining = remaining.substring(typedText.length);
    return newRemaining.length > 0 ? newRemaining : null;
  }

  notePosition(position: vscode.Position) {
    this.lastPosition = position;
  }

  setCurrentCompletion(completion: string, completionId?: string) {
    this.currentCompletion = completion;
    this.acceptedOffset = 0;
    if (completionId) {
      this.activeCompletionId = completionId;
    }
  }

  getActiveCompletionId(): string | null {
    return this.activeCompletionId;
  }

  clearCurrentCompletion() {
    this.currentCompletion = null;
    this.acceptedOffset = 0;
    this.activeCompletionId = null;
  }

  getPrefetch(key: string): AutocompleteOutcome | undefined {
    if (this.prefetchResult?.key === key) {
      return this.prefetchResult.outcome;
    }
    return undefined;
  }

  getCompatiblePrefetch(
    uri: string,
    documentVersion: number,
    currentPrefix: string,
  ): AutocompleteOutcome | undefined {
    if (
      !this.prefetchResult?.key.startsWith(`${uri}:${documentVersion}:`) ||
      !currentPrefix.startsWith(this.prefetchResult.outcome.prefix)
    ) {
      return undefined;
    }
    const typedSinceFetch = currentPrefix.slice(
      this.prefetchResult.outcome.prefix.length,
    );
    if (!this.prefetchResult.outcome.completion.startsWith(typedSinceFetch)) {
      return undefined;
    }
    return {
      ...this.prefetchResult.outcome,
      completion: this.prefetchResult.outcome.completion.slice(
        typedSinceFetch.length,
      ),
    };
  }

  getPartial(key: string): string | undefined {
    if (this.partialResult?.key === key) {
      return this.partialResult.completion;
    }
    return undefined;
  }

  getPartialCompletionId(key: string): string | undefined {
    if (this.partialResult?.key === key) {
      return this.partialResult.completionId;
    }
    return undefined;
  }

  setPrefetch(
    key: string,
    outcome: AutocompleteOutcome,
    documentVersion?: number,
  ) {
    this.prefetchResult = { key, outcome };
    this.partialResult = null;
    this.setCurrentCompletion(outcome.completion, outcome.completionId);
    if (documentVersion !== undefined) {
      this.positionCache.set(key, outcome, documentVersion);
    }
  }

  getL1(
    key: string,
    documentVersion: number,
  ): AutocompleteOutcome | undefined {
    return this.positionCache.get(key, documentVersion);
  }

  invalidateDocument(uri: string) {
    this.positionCache.invalidateUri(uri);
    if (
      this.prefetchResult?.key.startsWith(`${uri}:`) ||
      this.partialResult?.key.startsWith(`${uri}:`)
    ) {
      this.prefetchResult = null;
      this.partialResult = null;
    }
  }

  setPartial(key: string, completion: string, completionId: string) {
    if (!completion) {
      return;
    }
    this.partialResult = { key, completion, completionId };
    this.setCurrentCompletion(completion, completionId);
  }

  /**
   * Start or join an LLM fetch. Aborts stale fetches for other cursor positions.
   * Reuses the in-flight signal when the same key is already fetching.
   */
  beginFetch(key: string, preserveCompatibleFetches = false): FetchHandle {
    if (!preserveCompatibleFetches) {
      for (const [existingKey, controller] of this.inFlightFetches) {
        if (existingKey !== key) {
          controller.abort();
          this.inFlightFetches.delete(existingKey);
        }
      }
    } else {
      while (this.inFlightFetches.size > 2) {
        const oldestKey = this.inFlightFetches.keys().next().value;
        if (!oldestKey) {
          break;
        }
        this.inFlightFetches.get(oldestKey)?.abort();
        this.inFlightFetches.delete(oldestKey);
      }
    }

    const existing = this.inFlightFetches.get(key);
    if (existing) {
      return { signal: existing.signal, isOwner: false };
    }

    const controller = new AbortController();
    this.inFlightFetches.set(key, controller);
    return { signal: controller.signal, isOwner: true };
  }

  endFetch(key: string) {
    this.inFlightFetches.delete(key);
  }

  clearOnAccept() {
    this.clearCurrentCompletion();
    this.activeCompletionId = null;
    this.prefetchResult = null;
    this.partialResult = null;
    this.lastPosition = null;
  }

  scheduleSuggestRefresh() {
    if (this.suggestRefreshTimer) {
      clearTimeout(this.suggestRefreshTimer);
    }
    this.suggestRefreshTimer = setTimeout(() => {
      this.suggestRefreshTimer = null;
      if (getStatusBarStatus() === StatusBarStatus.Enabled) {
        void vscode.commands.executeCommand(
          "editor.action.inlineSuggest.trigger",
        );
      }
    }, SUGGEST_REFRESH_MS);
  }

  dispose() {
    if (this.suggestRefreshTimer) {
      clearTimeout(this.suggestRefreshTimer);
    }
    for (const controller of this.inFlightFetches.values()) {
      controller.abort();
    }
    this.inFlightFetches.clear();
    this.positionCache.clear();
  }
}
