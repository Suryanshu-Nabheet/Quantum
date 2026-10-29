import type { AppDispatch } from "../store";
import { saveCurrentSession } from "../thunks/session";

const SESSION_SAVE_DEBOUNCE_MS = 750;
const SESSION_SAVE_MAX_WAIT_MS = 2000;

let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let maxWaitTimer: ReturnType<typeof setTimeout> | undefined;
let pendingDispatch: AppDispatch | undefined;
let saveQueue: Promise<void> = Promise.resolve();

function enqueueSessionSave(
  dispatch: AppDispatch,
  generateTitle: boolean,
  refreshMetadata: boolean,
): Promise<void> {
  const queuedSave = saveQueue
    .catch(() => undefined)
    .then(async () => {
      await dispatch(
        saveCurrentSession({
          openNewSession: false,
          generateTitle,
          refreshMetadata,
        }),
      ).unwrap();
    });

  saveQueue = queuedSave;
  void queuedSave.catch((error) => {
    console.error("Failed to save Agent chat history", error);
  });
  return queuedSave;
}

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
    void enqueueSessionSave(run, false, false);
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

export async function flushDebouncedSessionSave(
  dispatch: AppDispatch,
  options: { generateTitle?: boolean } = {},
): Promise<void> {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  if (maxWaitTimer) {
    clearTimeout(maxWaitTimer);
  }
  debounceTimer = undefined;
  maxWaitTimer = undefined;
  pendingDispatch = undefined;
  await enqueueSessionSave(
    dispatch,
    options.generateTitle ?? true,
    true,
  );
}
