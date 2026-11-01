import { AppDispatch } from "../store";
import { RootState } from "../store";
import { setInactive } from "../slices/sessionSlice";

/** Result of tool execution after one LLM stream completes. */
export type PostStreamPhaseResult = "continue" | "stop";

/**
 * Always clear isStreaming when the driver exits without scheduling another LLM turn.
 */
export function ensureAgentTurnInactive(
  dispatch: AppDispatch,
  getState: () => RootState,
): void {
  if (getState().session.isStreaming) {
    dispatch(setInactive());
  }
}
