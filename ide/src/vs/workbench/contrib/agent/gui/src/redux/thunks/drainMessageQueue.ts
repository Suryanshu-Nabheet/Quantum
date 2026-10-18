import { resolveEditorContent } from "../../components/mainInput/TipTapEditor/utils/resolveEditorContent";
import { AppDispatch, RootState, ThunkApiType } from "../store";
import {
  appendQueuedUserMessage,
  removeQueuedMessage,
} from "../slices/sessionSlice";
import { queuedMessageToSend } from "../util/messageQueue";

export async function injectQueuedMessageIfReady(
  phase: "break" | "done",
  dispatch: AppDispatch,
  extra: ThunkApiType["extra"],
  getState: () => RootState,
): Promise<boolean> {
  const state = getState();
  if (!state.session.isStreaming) {
    return false;
  }
  const head = queuedMessageToSend(state.session.messageQueue ?? [], phase);
  if (!head) {
    return false;
  }

  try {
    const defaultContextProviders =
      state.config.config.experimental?.defaultContext ?? [];
    const resolved = await resolveEditorContent({
      editorState: head.editorState,
      modifiers: head.modifiers,
      hostBridge: extra.hostBridge,
      defaultContextProviders,
      availableSlashCommands: state.config.config.slashCommands,
      dispatch,
      getState,
    });
    if ((getState().session.streamEpoch ?? 0) !== (state.session.streamEpoch ?? 0)) {
      return false;
    }
    if (!(getState().session.messageQueue ?? []).some((item) => item.id === head.id)) {
      return false;
    }
    dispatch(
      appendQueuedUserMessage({
        queueId: head.id,
        editorState: head.editorState,
        content: resolved.content,
        contextItems: resolved.selectedContextItems,
      }),
    );
    return true;
  } catch {
    dispatch(removeQueuedMessage(head.id));
    return false;
  }
}
