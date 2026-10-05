import { ModelRole } from "agent-config";
import { ModelDescription } from "core";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Shortcut from "../../../components/gui/Shortcut";
import { Card, Divider } from "../../../components/ui";
import { AddModelForm } from "../../../forms/AddModelForm";
import { useConfigureModelDialog } from "../../../hooks/useConfigureModelDialog";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { selectSelectedProfile } from "../../../redux/slices/profilesSlice";
import { setDialogMessage, setShowDialog } from "../../../redux/slices/uiSlice";
import { updateSelectedModelByRole } from "../../../redux/thunks/updateSelectedModelByRole";
import { updateUnifiedChatModel } from "../../../redux/thunks/updateUnifiedChatModel";
import { getMetaKeyLabel } from "../../../util";
import { buildConfigRoute } from "../../../util/navigation";
import { ConfigCrossLink } from "../components/ConfigCrossLink";
import { ConfigDisclosurePanel } from "../components/ConfigDisclosurePanel";
import { ConfigHeader } from "../components/ConfigHeader";
import { ModelRoleRow } from "../components/ModelRoleRow";
import { CONFIG_PAGE_GAP } from "../configLayout";

const DEFAULT_PROVIDER_ROLES: ModelRole[] = [
  "chat",
  "apply",
  "edit",
  "autocomplete",
];

export function AgentSettingsSection() {
  const selectedProfile = useAppSelector(selectSelectedProfile);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const config = useAppSelector((state) => state.config.config);
  const openConfigureModelDialog = useConfigureModelDialog();
  const [showAdvanced, setShowAdvanced] = useState(false);

  function handleAgentModelSelect(model: ModelDescription | null) {
    if (!model) {
      return;
    }
    void dispatch(
      updateUnifiedChatModel({
        modelTitle: model.title,
        selectedProfile,
      }),
    );
  }

  function handleAdvancedRoleUpdate(
    role: ModelRole,
    model: ModelDescription | null,
  ) {
    if (!model) {
      return;
    }
    void dispatch(
      updateSelectedModelByRole({
        role,
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
          roles={DEFAULT_PROVIDER_ROLES}
          formTitle="Add provider"
          onDone={() => dispatch(setShowDialog(false))}
        />,
      ),
    );
  }

  return (
    <div className={CONFIG_PAGE_GAP}>
      <ConfigHeader
        title="Agent"
        subtext="One model powers the Agent sidebar, inline edit, and applying code. Add providers under Models, then choose your default here."
        showAddButton={false}
      />

      <ConfigCrossLink onClick={() => navigate(buildConfigRoute("models"))}>
        Manage providers — API keys and credentials
      </ConfigCrossLink>

      <div className="flex flex-col gap-3">
        <Card>
          <ModelRoleRow
            role="chat"
            displayName="Agent model"
            shortcut={
              <span className="text-2xs text-description-muted">
                (<Shortcut>{`${getMetaKeyLabel()} L`}</Shortcut> focus ·{" "}
                <Shortcut>{`${getMetaKeyLabel()} I`}</Shortcut> edit)
              </span>
            }
            description="Used in the Agent sidebar (Chat, Plan, and Agent modes), inline edit, and apply."
            models={config.modelsByRole.chat}
            selectedModel={config.selectedModelByRole.chat ?? undefined}
            onSelect={handleAgentModelSelect}
            onConfigure={(model) => model && openConfigureModelDialog(model)}
            onAddModel={openAddProviderDialog}
          />
        </Card>

        <ConfigDisclosurePanel
          open={showAdvanced}
          onToggle={() => setShowAdvanced((v) => !v)}
          label="Show context & search models (optional)"
          expandedLabel="Hide context & search models (optional)"
        >
          <ModelRoleRow
            role="embed"
            displayName="Embeddings"
            description="Improves @-mention and codebase context retrieval. Defaults to a local model if unset."
            models={config.modelsByRole.embed}
            selectedModel={config.selectedModelByRole.embed ?? undefined}
            onSelect={(m) => handleAdvancedRoleUpdate("embed", m)}
            onConfigure={(model) => model && openConfigureModelDialog(model)}
            onAddModel={openAddProviderDialog}
          />
          <Divider />
          <ModelRoleRow
            role="rerank"
            displayName="Rerank"
            description="Reorders retrieved snippets for better relevance."
            models={config.modelsByRole.rerank}
            selectedModel={config.selectedModelByRole.rerank ?? undefined}
            onSelect={(m) => handleAdvancedRoleUpdate("rerank", m)}
            onConfigure={(model) => model && openConfigureModelDialog(model)}
            onAddModel={openAddProviderDialog}
          />
        </ConfigDisclosurePanel>
      </div>
    </div>
  );
}
