import { Cog6ToothIcon, TrashIcon } from "@heroicons/react/24/outline";
import { ModelDescription } from "core";
import { LLMConfigurationStatuses } from "core/llm/constants";
import { defaultBorderRadius } from "../../../components";
import { Button } from "../../../components/ui";

interface ConfiguredModelsListProps {
  models: ModelDescription[];
  onConfigure: (model: ModelDescription) => void;
  onDelete: (model: ModelDescription) => void;
}

function statusHint(model: ModelDescription): string | null {
  if (model.configurationStatus === LLMConfigurationStatuses.MISSING_API_KEY) {
    return "API key missing";
  }
  if (
    model.configurationStatus === LLMConfigurationStatuses.MISSING_ENV_SECRET
  ) {
    return "Env secret missing";
  }
  return null;
}

export function ConfiguredModelsList({
  models,
  onConfigure,
  onDelete,
}: ConfiguredModelsListProps) {
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {models.map((model) => {
        const hint = statusHint(model);
        return (
          <li
            key={model.title}
            className="bg-vsc-input-background flex items-center gap-3 border border-solid border-[color:var(--vscode-sideBar-border,rgba(128,128,128,0.22))] px-3 py-2.5"
            style={{ borderRadius: defaultBorderRadius }}
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{model.title}</div>
              <div className="text-description truncate text-xs">
                {model.provider}
                {model.model ? ` · ${model.model}` : ""}
              </div>
              {hint && (
                <div className="text-warning mt-0.5 truncate text-2xs">
                  {hint}
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onConfigure(model)}
                className="!my-0 inline-flex h-7 items-center gap-1.5 px-2.5"
                tooltip="Configure model"
              >
                <Cog6ToothIcon className="h-3.5 w-3.5 flex-shrink-0" />
                <span>Configure</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(model)}
                className="text-description hover:enabled:text-foreground !my-0 inline-flex h-7 w-7 items-center justify-center p-0"
                tooltip="Remove model"
              >
                <TrashIcon className="h-4 w-4 flex-shrink-0" />
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
