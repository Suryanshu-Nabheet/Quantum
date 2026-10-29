import type { AppDispatch } from "../store";
import { saveCurrentSession } from "../thunks/session";

const SESSION_SAVE_DEBOUNCE_MS = 750;
const SESSION_SAVE_MAX_WAIT_MS = 2000;

let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let maxWaitTimer: ReturnType<typeof setTimeout> | undefined;
let pendingDispatch: AppDispatch | undefined;

function savePendingSession(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = undefined;
  }
  if (maxWaitTimer) {
    clearTimeout(maxWaitTimer);
    maxWaitTimer = undefined;
  }
  const run = pendingDispatch;
  pendingDispatch = undefined;
  if (run) {
    void run(
      saveCurrentSession({
        openNewSession: false,
        generateTitle: false,
        refreshMetadata: false,
      }),
    );
  }
}

/** Coalesce history writes while guaranteeing checkpoints during long streams. */
export function scheduleDebouncedSessionSave(dispatch: AppDispatch): void {
  pendingDispatch = dispatch;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(savePendingSession, SESSION_SAVE_DEBOUNCE_MS);
  if (!maxWaitTimer) {
    maxWaitTimer = setTimeout(savePendingSession, SESSION_SAVE_MAX_WAIT_MS);
  }
}

export function flushDebouncedSessionSave(dispatch: AppDispatch): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  if (maxWaitTimer) {
    clearTimeout(maxWaitTimer);
  }
  debounceTimer = undefined;
  maxWaitTimer = undefined;
  pendingDispatch = undefined;
  void dispatch(
    saveCurrentSession({
      openNewSession: false,
      generateTitle: true,
    }),
  );
}
