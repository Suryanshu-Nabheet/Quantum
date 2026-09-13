import { ModelRole } from "agent-config";
import { ModelDescription } from "core";
import { useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import ConfirmationDialog from "../../../components/dialogs/ConfirmationDialog";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
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
  const ideMessenger = useContext(IdeMessengerContext);
  const navigate = useNavigate();
  const config = useAppSelector((state) => state.config.config);
  const configuredProviders = useMemo(() => {
    const models = uniqueModelsByTitle(config.modelsByRole);
    return groupModelsByProvider(models);
  }, [config.modelsByRole]);

  const openConfigureModelDialog = useConfigureModelDialog();

  function handleAddProvider() {
    dispatch(setShowDialog(true));
    dispatch(
      setDialogMessage(
        <AddModelForm
          roles={DEFAULT_CHAT_MODEL_ROLES}
          formTitle="Add provider"
          onDone={() => {
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
              await ideMessenger.request("config/deleteModel", {
                provider: group.credentialModel.provider,
                titlesToClear: group.models.map((m) => m.title),
              });
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
        subtext="Connect providers with an API key. Assign which model each feature uses on Model roles."
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

      <ConfigCrossLink onClick={() => navigate(buildConfigRoute("modelRoles"))}>
        Assign models to chat, autocomplete, edit, and other roles
      </ConfigCrossLink>
    </div>
  );
}
