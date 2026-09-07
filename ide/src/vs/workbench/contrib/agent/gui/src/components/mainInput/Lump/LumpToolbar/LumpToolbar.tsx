import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../../../../redux/hooks";
import {
  selectFirstPendingToolCall,
  selectPendingToolCalls,
} from "../../../../redux/selectors/selectToolCalls";
import { callToolById } from "../../../../redux/thunks/callToolById";
import { EditOutcomeToolbar } from "./EditOutcomeToolbar";
import { EditToolbar } from "./EditToolbar";
import { IsApplyingToolbar } from "./IsApplyingToolbar";
import { PendingApplyStatesToolbar } from "./PendingApplyStatesToolbar";
import { PendingToolCallToolbar } from "./PendingToolCallToolbar";
import { TtsActiveToolbar } from "./TtsActiveToolbar";

const isExecuteToolCallShortcut = (event: KeyboardEvent) => {
  const metaKey = event.metaKey || event.ctrlKey;
  return metaKey && event.key === "Enter";
};

export function LumpToolbar() {
  const dispatch = useAppDispatch();
  const ttsActive = useAppSelector((state) => state.ui.ttsActive);
  const isInEdit = useAppSelector((state) => state.session.isInEdit);
  const pendingToolCalls = useAppSelector(selectPendingToolCalls);
  const firstPendingToolCall = useAppSelector(selectFirstPendingToolCall);
  const editApplyState = useAppSelector(
    (state) => state.editModeState.applyState,
  );
  const applyStates = useAppSelector(
    (state) => state.session.codeBlockApplyStates.states,
  );
  const pendingApplyStates = applyStates.filter(
    (state) => state.status === "done",
  );
  const isApplying = applyStates.some((state) => state.status === "streaming");

  useEffect(() => {
    if (!firstPendingToolCall) {
      return;
    }

    const handleToolCallKeyboardShortcuts = (event: KeyboardEvent) => {
      // Accept only — reject/stop must be an explicit click so Cmd/Ctrl+Backspace
      // in the chat input keeps editing text instead of killing the agent.
      if (isExecuteToolCallShortcut(event)) {
        event.preventDefault();
        event.stopPropagation();
        void dispatch(
          callToolById({ toolCallId: firstPendingToolCall.toolCallId }),
        );
      }
    };

    document.addEventListener("keydown", handleToolCallKeyboardShortcuts);
    return () => {
      document.removeEventListener("keydown", handleToolCallKeyboardShortcuts);
    };
  }, [dispatch, firstPendingToolCall]);

  let content = null;

  if (isApplying) {
    content = <IsApplyingToolbar />;
  } else if (isInEdit) {
    if (editApplyState.status === "done") {
      content = <EditOutcomeToolbar />;
    } else {
      content = <EditToolbar />;
    }
  } else if (ttsActive) {
    content = <TtsActiveToolbar />;
  } else if (pendingToolCalls.length > 0) {
    content = <PendingToolCallToolbar />;
  } else if (pendingApplyStates.length > 0) {
    content = (
      <PendingApplyStatesToolbar pendingApplyStates={pendingApplyStates} />
    );
  }

  if (!content) {
    return null;
  }

  return (
    <div className="bg-input rounded-t-default border-command-border animate-in fade-in slide-in-from-bottom-1 border-l border-r border-t shadow-sm duration-200">
      <div className="xs:px-2 px-1 py-0.5">{content}</div>
    </div>
  );
}
