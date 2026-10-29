import { ModelRole } from "agent-config";
import { ModelDescription } from "core";
import { useContext, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ConfirmationDialog from "../../../components/dialogs/ConfirmationDialog";
import { HostBridgeContext } from "../../../context/HostBridge";
import { AddModelForm } from "../../../forms/AddModelForm";
import { useConfigureModelDialog } from "../../../hooks/useConfigureModelDialog";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { setDialogMessage, setShowDialog } from "../../../redux/slices/uiSlice";
import { buildConfigRoute } from "../../../util/navigation";
import { ConfigCrossLink } from "../components/ConfigCrossLink";
import { ConfigEmptyAction } from "../components/ConfigEmptyAction";
import { ConfigHeader } from "../components/ConfigHeader";
import { ConfiguredModelsList } from "../components/ConfiguredModelsList";
import { CONFIG_PAGE_GAP } from "../configLayout";
import {
  ConfiguredProviderGroup,
  groupModelsByProvider,
  includeEmptyConfiguredProviders,
  uniqueModelsByTitle,
} from "../modelHelpers";

const DEFAULT_CHAT_MODEL_ROLES: ModelRole[] = [
  "chat",
  "apply",
  "edit",
  "autocomplete",
];

export function ModelsSection() {
  const dispatch = useAppDispatch();
  const hostBridge = useContext(HostBridgeContext);
  const navigate = useNavigate();
  const config = useAppSelector((state) => state.config.config);
  const [pendingConfiguredModels, setPendingConfiguredModels] = useState<
    ModelDescription[]
  >([]);
  const configuredProviders = useMemo(() => {
    const models = uniqueModelsByTitle(config.modelsByRole);
    return includeEmptyConfiguredProviders(
      groupModelsByProvider(models),
      [...(config.configuredModels ?? []), ...pendingConfiguredModels],
    );
  }, [config.configuredModels, config.modelsByRole, pendingConfiguredModels]);

  const openConfigureModelDialog = useConfigureModelDialog();

  function handleAddProvider() {
    dispatch(setShowDialog(true));
    dispatch(
      setDialogMessage(
        <AddModelForm
          roles={DEFAULT_CHAT_MODEL_ROLES}
          formTitle="Add provider"
          onDone={(addedModel) => {
            if (addedModel) {
              setPendingConfiguredModels((current) => [...current, addedModel]);
            }
            dispatch(setShowDialog(false));
          }}
        />,
      ),
    );
  }

  function handleDeleteProvider(group: ConfiguredProviderGroup) {
    dispatch(
      setDialogMessage(
        <ConfirmationDialog
          title="Remove provider"
          text={`Remove ${group.displayName} and all ${group.models.length} model${group.models.length === 1 ? "" : "s"} from Settings? They will be unavailable for every role.`}
          confirmText="Remove"
          onConfirm={async () => {
            try {
              await hostBridge.request("config/deleteModel", {
                provider: group.credentialModel.provider,
                titlesToClear:
                  group.models.length > 0
                    ? group.models.map((m) => m.title)
                    : [group.credentialModel.title],
              });
              setPendingConfiguredModels((current) =>
                current.filter(
                  (model) =>
                    (model.underlyingProviderName || model.provider || "unknown")
                      .trim()
                      .toLowerCase() !== group.providerId,
                ),
              );
            } catch (error) {
              console.error("Failed to delete provider:", error);
            }
          }}
        />,
      ),
    );
    dispatch(setShowDialog(true));
  }

  return (
    <div className={CONFIG_PAGE_GAP}>
      <ConfigHeader
        title="Models"
        subtext="Connect providers with an API key. Choose defaults under Agent and Tab."
        onAddClick={handleAddProvider}
        addButtonTooltip="Add provider"
        addButtonLabel="Add provider"
      />

      {configuredProviders.length === 0 ? (
        <ConfigEmptyAction
          status="No providers configured"
          actionLabel="Add provider"
          onClick={handleAddProvider}
        />
      ) : (
        <ConfiguredModelsList
          providers={configuredProviders}
          onConfigure={(model: ModelDescription) =>
            openConfigureModelDialog(model)
          }
          onDelete={handleDeleteProvider}
        />
      )}

      <ConfigCrossLink onClick={() => navigate(buildConfigRoute("agent"))}>
        Set your Agent and Tab models
      </ConfigCrossLink>
    </div>
  );
}
