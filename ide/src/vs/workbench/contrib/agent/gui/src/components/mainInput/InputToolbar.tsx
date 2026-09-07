import {
  AtSymbolIcon,
  LightBulbIcon as LightBulbIconOutline,
  PhotoIcon,
} from "@heroicons/react/24/outline";
import { LightBulbIcon as LightBulbIconSolid } from "@heroicons/react/24/solid";
import { InputModifiers, ToolCallState } from "core";
import {
  modelSupportsImages,
  modelSupportsReasoning,
} from "core/llm/autodetect";
import { BuiltInToolNames } from "core/tools/builtIn";
import { memo, useContext, useRef } from "react";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectToolCallsByStatus } from "../../redux/selectors/selectToolCalls";
import { selectSelectedChatModel } from "../../redux/slices/configSlice";
import { cancelToolCall } from "../../redux/slices/sessionSlice";
import { setHasReasoningEnabled } from "../../redux/slices/sessionSlice";
import { setReasoningSetting } from "../../redux/slices/uiSlice";
import { cancelStream } from "../../redux/thunks/cancelStream";
import { exitEdit } from "../../redux/thunks/edit";
import { logToolUsage } from "../../redux/util";
import { ToolTip } from "../gui/Tooltip";
import ModelSelect from "../modelSelection/ModelSelect";
import { ModeSelect } from "../ModeSelect";
import { Button } from "../ui";
import { useFontSize } from "../ui/font";
import ContextStatus from "./ContextStatus";
import HoverItem from "./InputToolbar/HoverItem";

export interface ToolbarOptions {
  hideImageUpload?: boolean;
  hideAddContext?: boolean;
  enterText?: string;
  hideSelectModel?: boolean;
}

interface InputToolbarProps {
  onEnter?: (modifiers: InputModifiers) => void;
  onAddContextItem?: () => void;
  onClick?: () => void;
  onImageFileSelected?: (file: File) => void;
  hidden?: boolean;
  activeKey: string | null;
  toolbarOptions?: ToolbarOptions;
  disabled?: boolean;
  isMainInput?: boolean;
}

function InputToolbar(props: InputToolbarProps) {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const defaultModel = useAppSelector(selectSelectedChatModel);
  const isInEdit = useAppSelector((store) => store.session.isInEdit);
  const codeToEdit = useAppSelector((store) => store.editModeState.codeToEdit);
  const isStreaming = useAppSelector((state) => state.session.isStreaming);
  const hasReasoningEnabled = useAppSelector(
    (store) => store.session.hasReasoningEnabled,
  );

  // Terminal command detection logic
  const runningToolCalls = useAppSelector((state) =>
    selectToolCallsByStatus(state, "calling"),
  );
  const isTerminalCommand = (toolCallState: ToolCallState) => {
    return (
      toolCallState?.toolCall?.function?.name ===
      BuiltInToolNames.RunTerminalCommand
    );
  };
  const runningTerminalCalls = runningToolCalls.filter(isTerminalCommand);
  const hasRunningTerminalCommand = runningTerminalCalls.length > 0;

  const isCurrentlyInProcess = isStreaming || hasRunningTerminalCommand;

  const isEnterDisabled =
    (props.disabled && !isCurrentlyInProcess) ||
    (isInEdit && codeToEdit.length === 0);

  const handleStopAllProcesses = async () => {
    // 1. Stop all terminal commands concurrently
    if (hasRunningTerminalCommand) {
      const stopPromises = runningTerminalCalls.map(
        async (terminalCall: ToolCallState) => {
          try {
            await ideMessenger.request("process/killTerminalProcess", {
              toolCallId: terminalCall.toolCallId,
            });
            dispatch(cancelToolCall({ toolCallId: terminalCall.toolCallId }));
            logToolUsage(terminalCall, false, true, ideMessenger);
          } catch (error) {
            console.error(`Failed to cancel terminal:`, error);
          }
        },
      );
      await Promise.all(stopPromises);
    }

    // 2. Also stop regular streaming if it's happening
    if (isStreaming) {
      void dispatch(cancelStream());
    }
  };

  const supportsImages =
    defaultModel &&
    modelSupportsImages(
      defaultModel.provider,
      defaultModel.model,
      defaultModel.title,
      defaultModel.capabilities,
    );

  const supportsReasoning = modelSupportsReasoning(defaultModel);

  const smallFont = useFontSize(-2);
  const tinyFont = useFontSize(-3);

  return (
    <>
      <div
        onClick={props.onClick}
        className={`find-widget-skip bg-vsc-input-background flex select-none flex-row items-center justify-between gap-1 overflow-hidden ${props.hidden ? "pointer-events-none h-0 cursor-default opacity-0" : "pointer-events-auto mt-1 cursor-text opacity-100"}`}
        style={{
          fontSize: smallFont,
        }}
      >
        <div className="xs:gap-1.5 flex min-w-0 flex-1 flex-row items-center gap-1 overflow-hidden">
          {!isInEdit && (
            <ToolTip place="top" content="Select Mode">
              <HoverItem className="!p-0">
                <ModeSelect />
              </HoverItem>
            </ToolTip>
          )}
          <ToolTip place="top" content="Select Model">
            <HoverItem className="!p-0">
              <ModelSelect />
            </HoverItem>
          </ToolTip>
          <div className="xs:flex text-description -mb-1 hidden items-center transition-colors duration-200">
            {!props.toolbarOptions?.hideImageUpload && supportsImages && (
                <>
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: "none" }}
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/svg+xml,.jpg,.jpeg,.png,.gif,.webp,.svg"
                    onChange={(e) => {
                      const files = e.target?.files ?? [];
                      for (const file of files) {
                        props.onImageFileSelected?.(file);
                      }
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                  />

                  <ToolTip place="top" content="Attach Image">
                    <HoverItem
                      className=""
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                    >
                      <PhotoIcon className="h-3 w-3 hover:brightness-125" />
                    </HoverItem>
                  </ToolTip>
                </>
              )}
            {!props.toolbarOptions?.hideAddContext && (
              <ToolTip place="top" content="Attach Context">
                <HoverItem onClick={props.onAddContextItem}>
                  <AtSymbolIcon className="h-3 w-3 hover:brightness-125" />
                </HoverItem>
              </ToolTip>
            )}
            {supportsReasoning && (
              <HoverItem
                onClick={() => {
                  dispatch(setHasReasoningEnabled(!hasReasoningEnabled));
                  if (defaultModel?.title) {
                    dispatch(
                      setReasoningSetting({
                        modelTitle: defaultModel.title,
                        enabled: !hasReasoningEnabled,
                      }),
                    );
                  }
                }}
              >
                <ToolTip
                  place="top"
                  content={
                    hasReasoningEnabled
                      ? "Disable model reasoning"
                      : "Enable model reasoning"
                  }
                >
                  {hasReasoningEnabled ? (
                    <LightBulbIconSolid className="h-3 w-3 brightness-200 hover:brightness-150" />
                  ) : (
                    <LightBulbIconOutline className="h-3 w-3 hover:brightness-150" />
                  )}
                </ToolTip>
              </HoverItem>
            )}
          </div>
        </div>

        <div
          className="text-description flex min-w-0 shrink-0 items-center gap-1.5 whitespace-nowrap"
          style={{
            fontSize: tinyFont,
          }}
        >
          {!isInEdit && <ContextStatus />}
          {isInEdit && (
            <ToolTip place="top" content="Exit edit mode (Esc)">
              <HoverItem
                className="hidden hover:underline sm:flex"
                onClick={async () => {
                  void dispatch(exitEdit({}));
                  ideMessenger.post("focusEditor", undefined);
                }}
              >
                <span>
                  <i>Esc</i> to exit Edit
                </span>
              </HoverItem>
            </ToolTip>
          )}
          <ToolTip
            place="top"
            content={isCurrentlyInProcess ? "Stop (⏎)" : "Send (⏎)"}
          >
            <Button
              variant={
                isCurrentlyInProcess
                  ? "secondary"
                  : props.isMainInput
                    ? "primary"
                    : "secondary"
              }
              size="sm"
              data-testid="submit-input-button"
              className="shrink-0"
              onClick={async (e) => {
                if (isCurrentlyInProcess) {
                  void handleStopAllProcesses();
                  return;
                }
                if (props.onEnter) {
                  props.onEnter({
                    noContext: true,
                  });
                }
              }}
              disabled={isEnterDisabled}
            >
              {isCurrentlyInProcess
                ? "Stop"
                : (props.toolbarOptions?.enterText ?? "Enter")}
            </Button>
          </ToolTip>
        </div>
      </div>
    </>
  );
}

function shallowToolbarOptionsEqual(a?: ToolbarOptions, b?: ToolbarOptions) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.hideAddContext === b.hideAddContext &&
    a.hideImageUpload === b.hideImageUpload &&
    a.hideSelectModel === b.hideSelectModel &&
    a.enterText === b.enterText
  );
}

export default memo(
  InputToolbar,
  (prev, next) =>
    prev.hidden === next.hidden &&
    prev.disabled === next.disabled &&
    prev.isMainInput === next.isMainInput &&
    prev.activeKey === next.activeKey &&
    shallowToolbarOptionsEqual(prev.toolbarOptions, next.toolbarOptions),
);
