import { normalizeTodos } from "core/tools/implementations/writeTodos";
import { AppDispatch } from "../store";
import { setTodos, setTodosSnapshot } from "../slices/sessionSlice";

/**
 * Mirrors a successful write_todos call into session state. The arguments are
 * re-validated with the same rules the tool enforces, so the stored list always
 * matches the tool contract. Invalid payloads are ignored, never partially applied.
 *
 * Each call also records a snapshot on its own tool call, so the chat shows the
 * list as it stood at that moment (like Cursor), not the latest list.
 */
export function syncTodosFromToolCall(
  toolCallId: string,
  rawArguments: string,
  dispatch: AppDispatch,
): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawArguments);
  } catch {
    return;
  }

  try {
    const todos = normalizeTodos((parsed as { todos?: unknown })?.todos);
    dispatch(setTodos(todos));
    dispatch(setTodosSnapshot({ toolCallId, todos }));
  } catch {
    // The tool already reported the validation error to the model.
  }
}
