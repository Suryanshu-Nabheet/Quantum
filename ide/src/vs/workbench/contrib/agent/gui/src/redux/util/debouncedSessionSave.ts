import type { AppDispatch } from "../store";
import { saveCurrentSession } from "../thunks/session";

const SESSION_SAVE_DEBOUNCE_MS = 2000;

let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let pendingDispatch: AppDispatch | undefined;

/** Coalesce history writes during multi-step agent loops. */
export function scheduleDebouncedSessionSave(dispatch: AppDispatch): void {
  pendingDispatch = dispatch;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = undefined;
    const run = pendingDispatch;
    pendingDispatch = undefined;
    if (!run) {
      return;
    }
    void run(
      saveCurrentSession({
        openNewSession: false,
        generateTitle: false,
      }),
    );
  }, SESSION_SAVE_DEBOUNCE_MS);
}

export function flushDebouncedSessionSave(dispatch: AppDispatch): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = undefined;
  }
  pendingDispatch = undefined;
  void dispatch(
    saveCurrentSession({
      openNewSession: false,
      generateTitle: true,
    }),
  );
}

/** Test-only reset */
export function resetDebouncedSessionSaveForTests(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = undefined;
  }
  pendingDispatch = undefined;
}
