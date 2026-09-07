import { Mutex } from "async-mutex";

interface CacheEntry {
  value: string;
  timestamp: number;
}

/**
 * In-memory LRU cache for autocomplete results. SQLite removed as per user request.
 */
export class AutocompleteLruCache {
  private static capacity = 4000;
  private static instancePromise?: Promise<AutocompleteLruCache>;
  private mutex = new Mutex();
  private cache: Map<string, CacheEntry> = new Map();

  constructor() {}

  /**
   * Singleton accessor that initializes the cache.
   */
  static async get(): Promise<AutocompleteLruCache> {
    if (!AutocompleteLruCache.instancePromise) {
      AutocompleteLruCache.instancePromise = Promise.resolve(new AutocompleteLruCache());
    }
    return AutocompleteLruCache.instancePromise;
  }

  /**
   * Retrieves a cached completion for an exact request key.
   */
  async get(key: string): Promise<string | undefined> {
    const exact = this.cache.get(key);
    if (exact) {
      exact.timestamp = Date.now();
      return exact.value;
    }
    return undefined;
  }

  /**
   * Stores a request-key-to-completion mapping in the cache.
   */
  async put(key: string, completion: string) {
    const release = await this.mutex.acquire();

    try {
      this.cache.set(key, {
        value: completion,
        timestamp: Date.now(),
      });

      if (this.cache.size > AutocompleteLruCache.capacity) {
        let oldestKey: string | null = null;
        let oldestTime = Infinity;

        for (const [key, entry] of this.cache.entries()) {
          if (entry.timestamp < oldestTime) {
            oldestTime = entry.timestamp;
            oldestKey = key;
          }
        }

        if (oldestKey) {
          this.cache.delete(oldestKey);
        }
      }
    } finally {
      release();
    }
  }

  async flush() {
    // No-op
  }

  async close() {
    this.cache.clear();
    AutocompleteLruCache.instancePromise = undefined;
  }
}
export default AutocompleteLruCache;
