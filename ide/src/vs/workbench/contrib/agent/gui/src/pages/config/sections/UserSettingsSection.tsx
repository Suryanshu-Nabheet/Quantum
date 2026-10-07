import {
  SharedConfigSchema,
  modifyAnyConfigWithSharedConfig,
} from "core/config/sharedConfig";
import { getReadResponseTTS } from "core/config/uiPreferences";
import { useContext } from "react";
import { useFontSize } from "../../../components/ui";
import { ConfigPanel } from "../components/ConfigPanel";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { updateConfig } from "../../../redux/slices/configSlice";
import { setLocalStorage } from "../../../util/localStorage";
import { ConfigHeader } from "../components/ConfigHeader";
import { ConfigPageSection } from "../components/ConfigPageSection";
import { UserSetting } from "../components/UserSetting";
import { useWorkbenchAppearanceLayout } from "../../../hooks/useWorkbenchAppearanceLayout";
import { CONFIG_PAGE_GAP, CONFIG_SECTIONS_STACK } from "../configLayout";

export function UserSettingsSection() {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const config = useAppSelector((state) => state.config.config);

  function handleUpdate(sharedConfig: SharedConfigSchema) {
    const updatedConfig = modifyAnyConfigWithSharedConfig(config, sharedConfig);
    dispatch(updateConfig(updatedConfig));
    ideMessenger.post("config/updateSharedConfig", sharedConfig);
  }

  const showSessionTabs = config.ui?.showSessionTabs ?? false;
  const resumeAfterToolRejection =
    config.ui?.resumeAfterToolRejection ?? false;
  const codeWrap = config.ui?.codeWrap ?? false;
  const showChatScrollbar = config.ui?.showChatScrollbar ?? false;
  const readResponseTTS = getReadResponseTTS(config);
  const displayRawMarkdown = config.ui?.displayRawMarkdown ?? false;
  const disableSessionTitles = config.disableSessionTitles ?? false;
  const onlyUseSystemMessageTools =
    config.experimental?.onlyUseSystemMessageTools ?? false;

  const fontSize = useFontSize();
  const {
    layout: workbenchLayout,
    loading: workbenchLayoutLoading,
    setStatusBarVisible,
    setActivityBarOrientation,
  } = useWorkbenchAppearanceLayout();

  return (
    <div className={CONFIG_PAGE_GAP}>
      <ConfigHeader
        title="General"
        subtext="Appearance and Agent sidebar preferences. Models live under Agent and Tab."
        showAddButton={false}
      />

      <div className={CONFIG_SECTIONS_STACK}>
        <ConfigPageSection title="Agent sidebar">
          <ConfigPanel>
              <UserSetting
                type="toggle"
                title="Show Session Tabs"
                description="Displays tabs above the chat as an alternative way to organize and access your sessions."
                value={showSessionTabs}
                onChange={(value) => handleUpdate({ showSessionTabs: value })}
              />
              <UserSetting
                type="toggle"
                title="Wrap Codeblocks"
                description="Wraps long lines in code blocks instead of showing horizontal scroll."
                value={codeWrap}
                onChange={(value) => handleUpdate({ codeWrap: value })}
              />
              <UserSetting
                type="toggle"
                title="Show Chat Scrollbar"
                description="Enables a scrollbar in the chat window."
                value={showChatScrollbar}
                onChange={(value) =>
                  handleUpdate({ showChatScrollbar: value })
                }
              />
              <UserSetting
                type="toggle"
                title="Text-to-Speech Output"
                description="Reads LLM responses aloud with TTS."
                value={readResponseTTS}
                onChange={(value) => handleUpdate({ readResponseTTS: value })}
              />
              <UserSetting
                type="toggle"
                title="Enable Session Titles"
                description="Generates summary titles for each session after the first message, using the current Agent model."
                value={!disableSessionTitles}
                onChange={(value) =>
                  handleUpdate({ disableSessionTitles: !value })
                }
              />
              <UserSetting
                type="toggle"
                title="Format Markdown"
                description="If off, shows responses as raw text."
                value={!displayRawMarkdown}
                onChange={(value) =>
                  handleUpdate({ displayRawMarkdown: !value })
                }
              />
              <UserSetting
                type="toggle"
                title="Stream after tool rejection"
                description="Streaming will resume after the tool call is rejected."
                value={resumeAfterToolRejection}
                onChange={(value) =>
                  handleUpdate({ resumeAfterToolRejection: value })
                }
              />
              <UserSetting
                type="toggle"
                title="System-message tools only"
                description="Send tool definitions in the system message instead of native tool calling when the model supports it."
                value={onlyUseSystemMessageTools}
                onChange={(value) =>
                  handleUpdate({ onlyUseSystemMessageTools: value })
                }
              />
          </ConfigPanel>
        </ConfigPageSection>

        <ConfigPageSection title="Appearance">
          <ConfigPanel>
            <UserSetting
              type="number"
              title="Font size"
              description="Base text size for chat and settings in this panel."
              value={fontSize}
              onChange={(val) => {
                setLocalStorage("fontSize", val);
                handleUpdate({ fontSize: val });
              }}
              min={7}
              max={50}
            />
            <UserSetting
              type="toggle"
              title="Status bar"
              description="Show branch, problems, and language mode along the bottom of the window."
              value={workbenchLayout?.statusBarVisible ?? true}
              disabled={workbenchLayoutLoading || workbenchLayout === null}
              onChange={(value) => void setStatusBarVisible(value)}
            />
            <UserSetting
              type="segmented"
              title="Activity bar layout"
              description="Classic icons on the side, or a horizontal row above the primary sidebar."
              controlAriaLabel="Activity bar layout"
              value={workbenchLayout?.activityBarOrientation ?? "vertical"}
              disabled={workbenchLayoutLoading || workbenchLayout === null}
              onChange={(value) =>
                void setActivityBarOrientation(
                  value as "vertical" | "horizontal",
                )
              }
              options={[
                { label: "Vertical", value: "vertical" },
                { label: "Horizontal", value: "horizontal" },
              ]}
            />
          </ConfigPanel>
        </ConfigPageSection>
      </div>
    </div>
  );
}
