import {
  SharedConfigSchema,
  modifyAnyConfigWithSharedConfig,
} from "core/config/sharedConfig";
import { getReadResponseTTS } from "core/config/uiPreferences";
import { useContext, useEffect, useState } from "react";
import { Card, useFontSize } from "../../../components/ui";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { updateConfig } from "../../../redux/slices/configSlice";
import { setLocalStorage } from "../../../util/localStorage";
import { ConfigHeader } from "../components/ConfigHeader";
import { UserSetting } from "../components/UserSetting";
import { CONFIG_CARD_STACK, CONFIG_PAGE_GAP } from "../configLayout";

export function UserSettingsSection() {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const config = useAppSelector((state) => state.config.config);

  function handleUpdate(sharedConfig: SharedConfigSchema) {
    const updatedConfig = modifyAnyConfigWithSharedConfig(config, sharedConfig);
    dispatch(updateConfig(updatedConfig));
    ideMessenger.post("config/updateSharedConfig", sharedConfig);
  }

  const disableAutocompleteInFiles = (
    config.tabAutocompleteOptions?.disableInFiles ?? []
  ).join(", ");
  const [formDisableAutocomplete, setFormDisableAutocomplete] = useState(
    disableAutocompleteInFiles,
  );

  useEffect(() => {
    setFormDisableAutocomplete(disableAutocompleteInFiles);
  }, [disableAutocompleteInFiles]);

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

  const useAutocompleteMultilineCompletions =
    config.tabAutocompleteOptions?.multilineCompletions ?? "auto";
  const useAutocompleteCache =
    config.tabAutocompleteOptions?.useCache ?? true;
  const modelTimeout = config.tabAutocompleteOptions?.modelTimeout ?? 6000;
  const debounceDelay = config.tabAutocompleteOptions?.debounceDelay ?? 0;
  const autocompleteFirstTokenMs =
    config.tabAutocompleteOptions?.showWhateverWeHaveAtXMs ?? 400;
  const fontSize = useFontSize();

  const cancelChangeDisableAutocomplete = () => {
    setFormDisableAutocomplete(disableAutocompleteInFiles);
  };
  const handleDisableAutocompleteSubmit = () => {
    handleUpdate({
      disableAutocompleteInFiles: formDisableAutocomplete
        .split(",")
        .map((val) => val.trim())
        .filter((val) => !!val),
    });
  };

  return (
    <div className={CONFIG_PAGE_GAP}>
      <ConfigHeader
        title="General"
        subtext="Chat, appearance, and autocomplete preferences"
        showAddButton={false}
      />
      <div className={CONFIG_PAGE_GAP}>
        <div>
          <ConfigHeader
            title="Chat"
            variant="sm"
            showAddButton={false}
          />
          <Card>
            <div className={CONFIG_CARD_STACK}>
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
                description="Generates summary titles for each chat session after the first message, using the current Chat model."
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
            </div>
          </Card>
        </div>

        <div>
          <ConfigHeader
            title="Appearance"
            variant="sm"
            showAddButton={false}
          />
          <Card>
            <div className={CONFIG_CARD_STACK}>
              <UserSetting
                type="number"
                title="Font Size"
                description="Specifies base font size for UI elements."
                value={fontSize}
                onChange={(val) => {
                  setLocalStorage("fontSize", val);
                  handleUpdate({ fontSize: val });
                }}
                min={7}
                max={50}
              />
            </div>
          </Card>
        </div>

        <div>
          <ConfigHeader
            title="Autocomplete"
            variant="sm"
            subtext="Inline ghost completions while you type — manage models under Models, assign under Model roles"
            showAddButton={false}
          />
          <Card>
            <div className={CONFIG_CARD_STACK}>
              <UserSetting
                type="toggle"
                title="Completion cache"
                description="Reuse recent completions for identical prefixes (faster, less model load)."
                value={useAutocompleteCache}
                onChange={(value) =>
                  handleUpdate({ useAutocompleteCache: value })
                }
              />
              <UserSetting
                type="select"
                title="Multiline Autocompletions"
                description="Controls multiline completions for autocomplete."
                value={useAutocompleteMultilineCompletions}
                onChange={(value) =>
                  handleUpdate({
                    useAutocompleteMultilineCompletions: value as
                      | "auto"
                      | "always"
                      | "never",
                  })
                }
                options={[
                  { label: "Auto", value: "auto" },
                  { label: "Always", value: "always" },
                  { label: "Never", value: "never" },
                ]}
              />
              <UserSetting
                type="number"
                title="Autocomplete Timeout (ms)"
                description="Maximum time in milliseconds for autocomplete request/retrieval."
                value={modelTimeout}
                onChange={(val) => handleUpdate({ modelTimeout: val })}
                min={100}
                max={5000}
              />
              <UserSetting
                type="number"
                title="Autocomplete Debounce (ms)"
                description="Delay after a keystroke before requesting a completion. Lower = faster, slightly more CPU."
                value={debounceDelay}
                onChange={(val) => handleUpdate({ debounceDelay: val })}
                min={0}
                max={2500}
              />
              <UserSetting
                type="number"
                title="Show first tokens after (ms)"
                description="Display partial completions once the model streams this many milliseconds (lower feels snappier)."
                value={autocompleteFirstTokenMs}
                onChange={(val) =>
                  handleUpdate({ autocompleteFirstTokenMs: val })
                }
                min={50}
                max={2000}
              />
              <UserSetting
                type="input"
                title="Disable autocomplete in files"
                description="List of comma-separated glob pattern to disable autocomplete in matching files."
                placeholder="**/*.(txt,md)"
                value={formDisableAutocomplete}
                onChange={setFormDisableAutocomplete}
                onSubmit={handleDisableAutocompleteSubmit}
                onCancel={cancelChangeDisableAutocomplete}
                isDirty={
                  formDisableAutocomplete !== disableAutocompleteInFiles
                }
                isValid={formDisableAutocomplete.trim() !== ""}
              />
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
}
