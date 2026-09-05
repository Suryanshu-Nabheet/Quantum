import { ModelRole } from "agent-config";
import { ModelDescription } from "core";
import { useNavigate } from "react-router-dom";
import Shortcut from "../../../components/gui/Shortcut";
import { Card, Divider } from "../../../components/ui";
import { AddModelForm } from "../../../forms/AddModelForm";
import { useConfigureModelDialog } from "../../../hooks/useConfigureModelDialog";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { selectSelectedProfile } from "../../../redux/slices/profilesSlice";
import { setDialogMessage, setShowDialog } from "../../../redux/slices/uiSlice";
import { updateSelectedModelByRole } from "../../../redux/thunks/updateSelectedModelByRole";
import { getMetaKeyLabel } from "../../../util";
import { buildConfigRoute } from "../../../util/navigation";
import { ConfigCrossLink } from "../components/ConfigCrossLink";
import { ConfigHeader } from "../components/ConfigHeader";
import { ModelRoleRow } from "../components/ModelRoleRow";
import { CONFIG_PAGE_GAP } from "../configLayout";

const DEFAULT_CHAT_MODEL_ROLES: ModelRole[] = [
  "chat",
  "apply",
  "edit",
  "autocomplete",
];

const ROLE_FORM_TITLES: Partial<Record<ModelRole, string>> = {
  chat: "Add chat model",
  autocomplete: "Add autocomplete model",
  edit: "Add edit model",
  apply: "Add apply model",
  embed: "Add embedding model",
  rerank: "Add rerank model",
  subagent: "Add subagent model",
};

export function ModelRolesSection() {
  const selectedProfile = useAppSelector(selectSelectedProfile);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const config = useAppSelector((state) => state.config.config);
  const openConfigureModelDialog = useConfigureModelDialog();

  function handleRoleUpdate(role: ModelRole, model: ModelDescription | null) {
    if (!model) {
      return;
    }

    void dispatch(
      updateSelectedModelByRole({
        role,
        selectedProfile,
        modelTitle: model.title,
      }),
    );
  }

  function handleConfigureModel(model: ModelDescription | null) {
    if (model) {
      openConfigureModelDialog(model);
    }
  }

  function openAddModelDialog(roles: ModelRole[], role: ModelRole) {
    dispatch(setShowDialog(true));
    dispatch(
      setDialogMessage(
        <AddModelForm
          roles={roles}
          formTitle={ROLE_FORM_TITLES[role] ?? "Add model"}
          onDone={() => {
            dispatch(setShowDialog(false));
          }}
        />,
      ),
    );
  }

  function handleAddModelForRole(role: ModelRole) {
    const roles = role === "chat" ? DEFAULT_CHAT_MODEL_ROLES : [role];
    openAddModelDialog(roles, role);
  }

  return (
    <div className={CONFIG_PAGE_GAP}>
      <ConfigHeader
        title="Model roles"
        subtext="Choose which configured model each feature uses. Add or remove models on the Models page."
        showAddButton={false}
      />

      <ConfigCrossLink
        className="-mt-1"
        onClick={() => navigate(buildConfigRoute("models"))}
      >
        Manage models — add, configure, or remove providers
      </ConfigCrossLink>

      <Card>
        <ModelRoleRow
          role="chat"
          displayName="Chat"
          shortcut={
            <span className="text-2xs text-description-muted">
              (<Shortcut>{`${getMetaKeyLabel()} L`}</Shortcut>)
            </span>
          }
          description="Used in Chat, Plan, and Agent mode"
          models={config.modelsByRole.chat}
          selectedModel={config.selectedModelByRole.chat ?? undefined}
          onSelect={(model) => handleRoleUpdate("chat", model)}
          onConfigure={handleConfigureModel}
          onAddModel={() => handleAddModelForRole("chat")}
        />

        <Divider />

        <ModelRoleRow
          role="autocomplete"
          displayName="Autocomplete"
          description="Inline completions as you type"
          models={config.modelsByRole.autocomplete}
          selectedModel={config.selectedModelByRole.autocomplete ?? undefined}
          onSelect={(model) => handleRoleUpdate("autocomplete", model)}
          onConfigure={handleConfigureModel}
          onAddModel={() => handleAddModelForRole("autocomplete")}
        />

        <Divider />

        <ModelRoleRow
          role="edit"
          displayName="Edit"
          shortcut={
            <span className="text-2xs text-description-muted">
              (<Shortcut>{`${getMetaKeyLabel()} I`}</Shortcut>)
            </span>
          }
          description="Transforms a selected section of code"
          models={config.modelsByRole.edit}
          selectedModel={config.selectedModelByRole.edit ?? undefined}
          onSelect={(model) => handleRoleUpdate("edit", model)}
          onConfigure={handleConfigureModel}
          onAddModel={() => handleAddModelForRole("edit")}
        />

        <Divider />

        <ModelRoleRow
          role="apply"
          displayName="Apply"
          description="Applies generated code blocks to files"
          models={config.modelsByRole.apply}
          selectedModel={config.selectedModelByRole.apply ?? undefined}
          onSelect={(model) => handleRoleUpdate("apply", model)}
          onConfigure={handleConfigureModel}
          onAddModel={() => handleAddModelForRole("apply")}
        />

        <Divider className="!my-3" />

        <ConfigHeader
          title="Context ranking"
          subtext="Optional models for retrieval and reranking"
          variant="sm"
          showAddButton={false}
          className="!mb-1"
        />

        <ModelRoleRow
          role="subagent"
          displayName="Subagent"
          description="Optional model for delegated sub-tasks"
          models={config.modelsByRole.subagent}
          selectedModel={config.selectedModelByRole.subagent ?? undefined}
          onSelect={(model) => handleRoleUpdate("subagent", model)}
          onConfigure={handleConfigureModel}
          onAddModel={() => handleAddModelForRole("subagent")}
        />

        <Divider />

        <ModelRoleRow
          role="embed"
          displayName="Embed"
          description="Override the default local embed model for retrieval"
          models={config.modelsByRole.embed}
          selectedModel={config.selectedModelByRole.embed ?? undefined}
          onSelect={(model) => handleRoleUpdate("embed", model)}
          onConfigure={handleConfigureModel}
          onAddModel={() => handleAddModelForRole("embed")}
        />

        <Divider />

        <ModelRoleRow
          role="rerank"
          displayName="Rerank"
          description="Reranks retrieved context for better relevance"
          models={config.modelsByRole.rerank}
          selectedModel={config.selectedModelByRole.rerank ?? undefined}
          onSelect={(model) => handleRoleUpdate("rerank", model)}
          onConfigure={handleConfigureModel}
          onAddModel={() => handleAddModelForRole("rerank")}
        />
      </Card>
    </div>
  );
}
