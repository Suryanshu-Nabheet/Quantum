import { ModelDescription } from "core";
import {
  SharedConfigSchema,
  modifyAnyConfigWithSharedConfig,
} from "core/config/sharedConfig";
import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../../../components/ui";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { AddModelForm } from "../../../forms/AddModelForm";
import { useConfigureModelDialog } from "../../../hooks/useConfigureModelDialog";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { selectSelectedProfile } from "../../../redux/slices/profilesSlice";
import { updateConfig } from "../../../redux/slices/configSlice";
import { setDialogMessage, setShowDialog } from "../../../redux/slices/uiSlice";
import { updateSelectedModelByRole } from "../../../redux/thunks/updateSelectedModelByRole";
import { buildConfigRoute } from "../../../util/navigation";
import { ConfigCrossLink } from "../components/ConfigCrossLink";
import { ConfigHeader } from "../components/ConfigHeader";
import { ModelRoleRow } from "../components/ModelRoleRow";
import { TabIgnorePatternsEditor } from "../components/TabIgnorePatternsEditor";
import { UserSetting } from "../components/UserSetting";
import { CONFIG_CARD_STACK, CONFIG_PAGE_GAP } from "../configLayout";

function ConfigSubsectionTitle({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-3">
      <p className="text-sm font-medium leading-5">{title}</p>
      {description && (
        <p className="text-description mt-1 text-xs leading-snug">
          {description}
        </p>
      )}
    </div>
  );
}

export function TabSettingsSection() {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const navigate = useNavigate();
  const config = useAppSelector((state) => state.config.config);
  const selectedProfile = useAppSelector(selectSelectedProfile);
  const openConfigureModelDialog = useConfigureModelDialog();

  const ignorePatterns = config.tabAutocompleteOptions?.disableInFiles ?? [];

  const useAutocompleteMultilineCompletions =
    config.tabAutocompleteOptions?.multilineCompletions ?? "auto";
  const useAutocompleteCache =
    config.tabAutocompleteOptions?.useCache ?? true;
  const modelTimeout = config.tabAutocompleteOptions?.modelTimeout ?? 6000;
  const debounceDelay = config.tabAutocompleteOptions?.debounceDelay ?? 0;
  const autocompleteFirstTokenMs =
    config.tabAutocompleteOptions?.showWhateverWeHaveAtXMs ?? 400;

  function handleUpdate(sharedConfig: SharedConfigSchema) {
    const updatedConfig = modifyAnyConfigWithSharedConfig(config, sharedConfig);
    dispatch(updateConfig(updatedConfig));
    ideMessenger.post("config/updateSharedConfig", sharedConfig);
  }

  function handleTabModelSelect(model: ModelDescription | null) {
    if (!model) {
      return;
    }
    void dispatch(
      updateSelectedModelByRole({
        role: "autocomplete",
        modelTitle: model.title,
        selectedProfile,
      }),
    );
  }

  function openAddProviderDialog() {
    dispatch(setShowDialog(true));
    dispatch(
      setDialogMessage(
        <AddModelForm
          roles={["autocomplete"]}
          formTitle="Add provider for Tab"
          onDone={() => dispatch(setShowDialog(false))}
        />,
      ),
    );
  }

  return (
    <div className={CONFIG_PAGE_GAP}>
      <ConfigHeader
        title="Tab"
        subtext="Inline ghost completions as you type. Choose a model and where Tab should stay silent."
        showAddButton={false}
      />

      <ConfigCrossLink onClick={() => navigate(buildConfigRoute("models"))}>
        Manage providers — enable Tab on a model under Models
      </ConfigCrossLink>

      <div className="flex flex-col gap-4">
        <Card>
          <ModelRoleRow
            role="autocomplete"
            displayName="Tab model"
            description="Inline suggestions only — can differ from your Agent model."
            models={config.modelsByRole.autocomplete}
            selectedModel={config.selectedModelByRole.autocomplete ?? undefined}
            onSelect={handleTabModelSelect}
            onConfigure={(model) => model && openConfigureModelDialog(model)}
            onAddModel={openAddProviderDialog}
          />
        </Card>

        <Card>
          <ConfigSubsectionTitle
            title="Ignored paths"
            description="Glob patterns or bare names (e.g. .env). Tab stays off in matching files."
          />
          <TabIgnorePatternsEditor
            patterns={ignorePatterns}
            onChange={(patterns) =>
              handleUpdate({ disableAutocompleteInFiles: patterns })
            }
          />
        </Card>

        <Card>
          <ConfigSubsectionTitle title="Behavior" />
          <div className={CONFIG_CARD_STACK}>
            <UserSetting
              type="toggle"
              title="Completion cache"
              description="Reuse recent completions for identical prefixes."
              value={useAutocompleteCache}
              onChange={(value) => handleUpdate({ useAutocompleteCache: value })}
            />
            <UserSetting
              type="select"
              title="Multiline completions"
              description="Whether Tab may suggest multiple lines at once."
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
              title="Request timeout (ms)"
              description="Maximum time to wait for a Tab completion."
              value={modelTimeout}
              onChange={(val) => handleUpdate({ modelTimeout: val })}
              min={100}
              max={15000}
            />
            <UserSetting
              type="number"
              title="Debounce (ms)"
              description="Delay after a keystroke before requesting a completion."
              value={debounceDelay}
              onChange={(val) => handleUpdate({ debounceDelay: val })}
              min={0}
              max={2500}
            />
            <UserSetting
              type="number"
              title="Show partial after (ms)"
              description="Stream partial suggestions after this delay."
              value={autocompleteFirstTokenMs}
              onChange={(val) =>
                handleUpdate({ autocompleteFirstTokenMs: val })
              }
              min={50}
              max={2000}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
