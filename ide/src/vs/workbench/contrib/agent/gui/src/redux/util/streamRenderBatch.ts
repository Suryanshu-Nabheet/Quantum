import { ChatMessage } from "core";
import { streamUpdate } from "../slices/sessionSlice";
import { AppDispatch } from "../store";

/** Coalesce high-frequency stream chunks; flush on the next microtask for low latency. */
export function createStreamRenderBatcher(dispatch: AppDispatch) {
  let pending: ChatMessage[] = [];
  let scheduled = false;

  const flush = () => {
    if (pending.length === 0) {
      return;
    }
    const batch = pending;
    pending = [];
    dispatch(streamUpdate(batch));
  };

  return {
    push(messages: ChatMessage[]) {
      if (!messages?.length) {
        return;
      }
      pending.push(...messages);
      if (scheduled) {
        return;
      }
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        flush();
      });
    },
    flushNow() {
      scheduled = false;
      flush();
    },
  };
}
