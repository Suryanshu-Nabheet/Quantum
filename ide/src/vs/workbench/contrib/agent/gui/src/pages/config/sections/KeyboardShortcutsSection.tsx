import { useContext } from "react";
import Shortcut from "../../../components/gui/Shortcut";
import { Card } from "../../../components/ui";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { AGENT_NAME, IDE_SETTINGS_LABEL } from "core/util/branding";
import { ConfigCrossLink } from "../components/ConfigCrossLink";
import { ConfigHeader } from "../components/ConfigHeader";
import { CONFIG_HAIRLINE_DIVIDE, CONFIG_PAGE_GAP } from "../configLayout";

const SHORTCUTS: { description: string; shortcut: string }[] = [
  { description: "Toggle selected model", shortcut: "cmd '" },
  { description: "Edit highlighted code", shortcut: "cmd I" },
  { description: "New chat / chat with selection", shortcut: "cmd L" },
  { description: "Toggle inline edit focus", shortcut: "cmd shift I" },
  { description: "Focus chat / add selected code", shortcut: "cmd shift L" },
  { description: "Debug terminal", shortcut: "cmd shift R" },
  { description: "Reject diff", shortcut: "cmd shift backspace" },
  { description: "Accept diff", shortcut: "cmd shift enter" },
  { description: "Reject top change in diff", shortcut: "alt cmd N" },
  { description: "Accept top change in diff", shortcut: "alt cmd Y" },
  { description: "Toggle autocomplete", shortcut: "cmd K, cmd A" },
  { description: "Force autocomplete trigger", shortcut: "cmd alt space" },
  { description: "Toggle full screen settings", shortcut: "cmd K, cmd M" },
];

export function KeyboardShortcutsSection() {
  const ideMessenger = useContext(IdeMessengerContext);

  return (
    <div className={CONFIG_PAGE_GAP}>
      <ConfigHeader
        title="Keyboard Shortcuts"
        subtext={`Shortcuts for ${AGENT_NAME}. Customize in ${IDE_SETTINGS_LABEL} → Keyboard Shortcuts.`}
        showAddButton={false}
      />

      <Card className="!p-0 overflow-hidden">
        <div className={CONFIG_HAIRLINE_DIVIDE}>
          {SHORTCUTS.map((item) => (
            <div
              key={item.description}
              className="flex items-center gap-4 px-4 py-2"
            >
              <span className="text-foreground min-w-0 flex-1 truncate text-sm leading-5">
                {item.description}
              </span>
              <Shortcut>{item.shortcut}</Shortcut>
            </div>
          ))}
        </div>
      </Card>

      <ConfigCrossLink
        onClick={() => ideMessenger.post("openKeyboardShortcuts", undefined)}
      >
        Open {IDE_SETTINGS_LABEL} → Keyboard Shortcuts
      </ConfigCrossLink>
    </div>
  );
}
