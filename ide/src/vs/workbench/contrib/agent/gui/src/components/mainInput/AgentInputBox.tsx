import { Editor, JSONContent } from "@tiptap/react";
import {
  ContextItemWithId,
  InputModifiers,
  RuleMetadata,
  SlashCommandSource,
} from "core";
import { memo, useMemo } from "react";
import { defaultBorderRadius, vscBackground } from "..";
import { useAppSelector } from "../../redux/hooks";
import {
  selectSlashCommandComboBoxInputs,
  selectStreamingStatus,
} from "../../redux/selectors";
import { ContextItemsPeek } from "./belowMainInput/ContextItemsPeek";
import { RulesPeek } from "./belowMainInput/RulesPeek";
import { GradientBorder } from "./GradientBorder";
import { ShinyLoading } from "./ShinyLoading";
import { ToolbarOptions } from "./InputToolbar";
import { Lump } from "./Lump";
import { TipTapEditor } from "./TipTapEditor";

interface AgentInputBoxProps {
  isLastUserInput: boolean;
  isMainInput?: boolean;
  onEnter: (
    editorState: JSONContent,
    modifiers: InputModifiers,
    editor: Editor,
  ) => void;
  editorState?: JSONContent;
  contextItems?: ContextItemWithId[];
  appliedRules?: RuleMetadata[];
  hidden?: boolean;
  inputId: string; // used to keep track of things per input in redux
}

const EDIT_DISALLOWED_CONTEXT_PROVIDERS = [
  "diff",
  "search",
];

const EDIT_ALLOWED_SLASH_COMMAND_SOURCES: SlashCommandSource[] = [
  "quantum-settings-prompt",
  "mcp-prompt",
  "invokable-rule",
  "built-in",
];

function AgentInputBox(props: AgentInputBoxProps) {
  const isStreaming = useAppSelector((state) => state.session.isStreaming);
  const availableSlashCommands = useAppSelector(
    selectSlashCommandComboBoxInputs,
  );
  const streamingStatus = useAppSelector(selectStreamingStatus);
  const availableContextProviders = useAppSelector(
    (state) => state.config.config.contextProviders,
  );
  const isInEdit = useAppSelector((store) => store.session.isInEdit);
  const editModeState = useAppSelector((state) => state.editModeState);

  const filteredSlashCommands = useMemo(() => {
    if (isInEdit) {
      return availableSlashCommands.filter((cmd) => {
        const source = cmd.slashCommandSource ?? cmd.source;
        return source
          ? EDIT_ALLOWED_SLASH_COMMAND_SOURCES.includes(source)
          : false;
      });
    }
    return availableSlashCommands;
  }, [isInEdit, availableSlashCommands]);

  const filteredContextProviders = useMemo(() => {
    if (isInEdit) {
      return (
        availableContextProviders?.filter(
          (provider) =>
            !EDIT_DISALLOWED_CONTEXT_PROVIDERS.includes(provider.title),
        ) ?? []
      );
    }

    return availableContextProviders ?? [];
  }, [availableContextProviders, isInEdit]);

  const historyKey = isInEdit ? "edit" : "chat";
  const placeholder = isInEdit ? "Edit selected code" : undefined;

  const toolbarOptions: ToolbarOptions = useMemo(() => {
    if (isInEdit) {
      return {
        hideAddContext: false,
        hideImageUpload: false,
        hideSelectModel: false,
        enterText:
          editModeState.applyState.status === "done" ? "Retry" : "Edit",
      } as ToolbarOptions;
    }
    // Stable empty object to avoid re-renders from identity changes
    return {} as ToolbarOptions;
  }, [isInEdit, editModeState.applyState.status]);

  const { appliedRules = [], contextItems = [] } = props;
  const showStreamingStatus =
    isStreaming && (props.isLastUserInput || isInEdit);
  const showPeeks = appliedRules.length > 0 || contextItems.length > 0;

  return (
    <div
      className={`${props.hidden ? "hidden" : ""}`}
      data-testid={`agent-input-box-${props.inputId}`}
    >
      <div className="relative flex w-full flex-col">
        {props.isMainInput && <Lump />}
        <GradientBorder
          loading={isStreaming && (props.isLastUserInput || isInEdit) ? 1 : 0}
          borderColor={
            isStreaming && (props.isLastUserInput || isInEdit)
              ? undefined
              : vscBackground
          }
          borderRadius={defaultBorderRadius}
        >
          <TipTapEditor
            editorState={props.editorState}
            onEnter={props.onEnter}
            placeholder={placeholder}
            isMainInput={props.isMainInput ?? false}
            availableContextProviders={filteredContextProviders}
            availableSlashCommands={filteredSlashCommands}
            historyKey={historyKey}
            toolbarOptions={toolbarOptions}
            inputId={props.inputId}
          />
        </GradientBorder>

        {showPeeks && (
          <div className="mt-1 flex flex-col gap-0.5">
            <RulesPeek appliedRules={props.appliedRules} />
            <ContextItemsPeek
              contextItems={props.contextItems}
              isCurrentContextPeek={props.isLastUserInput}
            />
          </div>
        )}

        {showStreamingStatus && (
          <ShinyLoading status={streamingStatus ?? undefined} />
        )}
      </div>
    </div>
  );
}

export default memo(AgentInputBox);
