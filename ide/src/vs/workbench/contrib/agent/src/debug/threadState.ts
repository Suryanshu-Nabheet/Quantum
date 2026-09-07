export const threadStopped: Map<number, boolean> = new Map();

export function normalizeThreadId(id: number | string): number {
  if (typeof id === "number") {
    return id;
  }
  const parsed = Number.parseInt(id, 10);
  return Number.isNaN(parsed) ? -1 : parsed;
}

export function markThreadStopped(id: number | string, stopped: boolean): void {
  const normalized = normalizeThreadId(id);
  if (normalized < 0) {
    return;
  }
  threadStopped.set(normalized, stopped);
}

export function isThreadStopped(id: number | string): boolean {
  const normalized = normalizeThreadId(id);
  if (normalized < 0) {
    return false;
  }
  return threadStopped.get(normalized) === true;
}

export function hasAnyStoppedThreads(): boolean {
  for (const stopped of threadStopped.values()) {
    if (stopped) {
      return true;
    }
  }
  return false;
}
