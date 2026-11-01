import { AutocompleteOutcome } from "./types.js";

/**
 * Coalesces duplicate in-flight autocomplete requests for the same cursor + prefix.
 * VS Code often triggers multiple overlapping calls; this avoids redundant LLM work.
 */
export class AutocompleteInflight {
  private static inflight = new Map<
    string,
    Promise<AutocompleteOutcome | undefined>
  >();

  static key(filepath: string, line: number, character: number, prefix: string) {
    return `${filepath}:${line}:${character}:${prefix}`;
  }

  static get(
    key: string,
  ): Promise<AutocompleteOutcome | undefined> | undefined {
    return this.inflight.get(key);
  }

  static track(
    key: string,
    promise: Promise<AutocompleteOutcome | undefined>,
  ): Promise<AutocompleteOutcome | undefined> {
    this.inflight.set(key, promise);
    void promise.finally(() => {
      if (this.inflight.get(key) === promise) {
        this.inflight.delete(key);
      }
    });
    return promise;
  }
}
