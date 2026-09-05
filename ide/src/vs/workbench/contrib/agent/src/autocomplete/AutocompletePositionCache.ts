import { AutocompleteOutcome } from "core/autocomplete/util/types";

const L1_TTL_MS = 30_000;
const MAX_ENTRIES = 500;

type CacheEntry = {
  outcome: AutocompleteOutcome;
  createdAt: number;
  documentVersion: number;
};

/**
 * L1 position cache — sub-ms hits for repeat cursor positions before LLM.
 * Invalidates on document version change or TTL expiry.
 */
export class AutocompletePositionCache {
  private cache = new Map<string, CacheEntry>();

  get(
    key: string,
    documentVersion: number,
  ): AutocompleteOutcome | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    if (Date.now() - entry.createdAt > L1_TTL_MS) {
      this.cache.delete(key);
      return undefined;
    }

    if (entry.documentVersion !== documentVersion) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.outcome;
  }

  set(
    key: string,
    outcome: AutocompleteOutcome,
    documentVersion: number,
  ): void {
    if (this.cache.size >= MAX_ENTRIES) {
      this.evictOldest();
    }
    this.cache.set(key, {
      outcome,
      createdAt: Date.now(),
      documentVersion,
    });
  }

  invalidateUri(uri: string): void {
    const prefix = `${uri}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of this.cache) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}
