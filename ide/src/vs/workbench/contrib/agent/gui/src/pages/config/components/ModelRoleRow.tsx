import { ModelRole } from "agent-config";
import { ModelDescription } from "core";
import { ReactNode } from "react";
import { defaultBorderRadius } from "../../../components";
import { ConfigEmptyAction } from "./ConfigEmptyAction";
import ModelRoleSelector from "./ModelRoleSelector";

interface ModelRoleRowProps {
  role: ModelRole;
  displayName: string;
  description: string | ReactNode;
  models: ModelDescription[];
  selectedModel: ModelDescription | undefined;
  onSelect: (model: ModelDescription | null) => void;
  onConfigure: (model: ModelDescription | null) => void;
  onAddModel?: () => void;
  shortcut?: ReactNode;
}

export function ModelRoleRow({
  role,
  displayName,
  description,
  models,
  selectedModel,
  onSelect,
  onConfigure,
  onAddModel,
  shortcut,
}: ModelRoleRowProps) {
  const isEmpty = models.length === 0;

  return (
    <div className="py-2.5 first:pt-0 last:pb-0">
      <div className="mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{displayName}</span>
          {shortcut && shortcut}
        </div>
        <p className="text-description mt-0.5 text-xs leading-snug">
          {description}
        </p>
      </div>

      {isEmpty ? (
        onAddModel ? (
          <ConfigEmptyAction
            status="Not configured"
            actionLabel="Add model"
            onClick={onAddModel}
          />
        ) : (
          <div
            className="bg-vsc-input-background text-description flex h-8 items-center border border-solid border-[color:var(--vscode-sideBar-border,rgba(128,128,128,0.22))] px-2.5 text-xs"
            style={{ borderRadius: defaultBorderRadius }}
          >
            Not configured
          </div>
        )
      ) : (
        <div className="h-8">
          <ModelRoleSelector
            role={role}
            displayName={displayName}
            description={description}
            models={models}
            selectedModel={selectedModel ?? null}
            onSelect={onSelect}
            onConfigureModel={(model) => onConfigure(model)}
            hideTitle={true}
          />
        </div>
      )}
    </div>
  );
}
