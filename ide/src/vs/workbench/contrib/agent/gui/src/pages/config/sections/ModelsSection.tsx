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
import { uniqueModelsByTitle } from "../modelHelpers";

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
  const configuredModels = useMemo(
    () => uniqueModelsByTitle(config.modelsByRole),
    [config.modelsByRole],
  );

  const openConfigureModelDialog = useConfigureModelDialog();

  function handleAddModel() {
    dispatch(setShowDialog(true));
    dispatch(
      setDialogMessage(
        <AddModelForm
          roles={DEFAULT_CHAT_MODEL_ROLES}
          formTitle="Add model"
          onDone={() => {
            dispatch(setShowDialog(false));
          }}
        />,
      ),
    );
  }

  function handleDeleteModel(model: ModelDescription) {
    dispatch(
      setDialogMessage(
        <ConfirmationDialog
          title="Remove model"
          text={`Remove "${model.title}" from Quantum Settings? It will be unavailable for every role (chat, autocomplete, edit, and others).`}
          confirmText="Remove"
          onConfirm={async () => {
            try {
              await ideMessenger.request("config/deleteModel", {
                title: model.title,
              });
            } catch (error) {
              console.error("Failed to delete model:", error);
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
        subtext="Add, configure, and remove providers. Assign which feature uses which model on Model roles."
        onAddClick={handleAddModel}
        addButtonTooltip="Add model"
        addButtonLabel="Add model"
      />

      {configuredModels.length === 0 ? (
        <ConfigEmptyAction
          status="No models configured"
          actionLabel="Add model"
          onClick={handleAddModel}
        />
      ) : (
        <ConfiguredModelsList
          models={configuredModels}
          onConfigure={(model) => openConfigureModelDialog(model)}
          onDelete={handleDeleteModel}
        />
      )}

      <ConfigCrossLink onClick={() => navigate(buildConfigRoute("modelRoles"))}>
        Assign models to chat, autocomplete, edit, and other roles
      </ConfigCrossLink>
    </div>
  );
}
