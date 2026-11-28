import { FolderIcon } from "@heroicons/react/24/outline";
import { ToolCallState } from "core";
import { CHAT_UI_TEXT_CLASS } from "../../../styles/chatLayout";
import { ToggleWithIcon } from "./ToggleWithIcon";
import { getGroupActionVerb } from "./utils";

interface GroupedToolCallHeaderProps {
  toolCallStates: ToolCallState[];
  activeCalls: ToolCallState[];
  open: boolean;
  onToggle: () => void;
}

export function GroupedToolCallHeader({
  toolCallStates,
  activeCalls,
  open,
  onToggle,
}: GroupedToolCallHeaderProps) {
  return (
    <div className={open ? "mb-0.5" : "mb-0"}>
      <button
        type="button"
        aria-expanded={open}
        className={`text-description flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-left ${CHAT_UI_TEXT_CLASS} transition-colors duration-200 ease-in-out hover:brightness-125 focus-visible:outline focus-visible:outline-1`}
        data-testid="performing-actions"
        onClick={onToggle}
      >
        <ToggleWithIcon
          isToggleable
          icon={FolderIcon}
          open={open}
        />
        {getGroupActionVerb(toolCallStates)} {activeCalls.length}{" "}
        {activeCalls.length === 1 ? "action" : "actions"}
      </button>
    </div>
  );
}
