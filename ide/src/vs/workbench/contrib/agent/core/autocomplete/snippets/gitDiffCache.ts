import { IDE } from "../..";

type GetDiffFn = () => Promise<string[]>;

export class GitDiffCache {
  private static instances = new Map<string, GitDiffCache>();
  private cachedDiff: string[] | undefined = undefined;
  private lastFetchTime: number = 0;
  private pendingRequest: Promise<string[]> | null = null;
  private getDiffFn: GetDiffFn;
  private cacheTimeMs: number;

  private constructor(getDiffFn: GetDiffFn, cacheTimeSeconds: number = 60) {
    this.getDiffFn = getDiffFn;
    this.cacheTimeMs = cacheTimeSeconds * 1000;
  }

  public static getInstance(
    getDiffFn: GetDiffFn,
    cacheTimeSeconds?: number,
    instanceKey = "include-unstaged",
  ): GitDiffCache {
    if (!GitDiffCache.instances.has(instanceKey)) {
      GitDiffCache.instances.set(
        instanceKey,
        new GitDiffCache(getDiffFn, cacheTimeSeconds),
      );
    }
    return GitDiffCache.instances.get(instanceKey)!;
  }

  public static invalidateAll(): void {
    for (const instance of GitDiffCache.instances.values()) {
      instance.invalidate();
    }
    GitDiffCache.instances.clear();
  }

  private async getDiffPromise(): Promise<string[]> {
    try {
      const diff = await this.getDiffFn();
      this.cachedDiff = diff;
      this.lastFetchTime = Date.now();
      return this.cachedDiff;
    } catch (e) {
      console.error("Error fetching git diff:", e);
      return [];
    } finally {
      this.pendingRequest = null;
    }
  }

  public async get(): Promise<string[]> {
    if (
      this.cachedDiff !== undefined &&
      Date.now() - this.lastFetchTime < this.cacheTimeMs
    ) {
      return this.cachedDiff;
    }

    // If there's already a request in progress, return that instead of starting a new one
    if (this.pendingRequest) {
      return this.pendingRequest;
    }

    this.pendingRequest = this.getDiffPromise();
    return this.pendingRequest;
  }

  public invalidate(): void {
    this.cachedDiff = undefined;
    this.pendingRequest = null;
  }
}

// factory to make diff cache more testable
export function getDiffFn(
  ide: IDE,
  includeUnstaged: boolean = true,
): GetDiffFn {
  return () => ide.getDiff(includeUnstaged);
}

export async function getDiffsFromCache(
  ide: IDE,
  includeUnstaged: boolean = true,
): Promise<string[]> {
  const instanceKey = includeUnstaged ? "include-unstaged" : "staged-only";
  const diffCache = GitDiffCache.getInstance(
    getDiffFn(ide, includeUnstaged),
    undefined,
    instanceKey,
  );
  return await diffCache.get();
}
