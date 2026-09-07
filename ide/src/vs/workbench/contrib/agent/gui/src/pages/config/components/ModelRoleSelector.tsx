import {
  CheckIcon,
  ChevronUpDownIcon,
  CubeIcon,
} from "@heroicons/react/24/outline";
import { ModelRole } from "agent-config";
import { ModelDescription } from "core";
import { LLMConfigurationStatuses } from "core/llm/constants";
import { MouseEvent, ReactNode } from "react";
import { defaultBorderRadius } from "../../../components";
import InfoHover from "../../../components/InfoHover";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from "../../../components/ui";
import { fontSize } from "../../../util";

interface ModelRoleSelectorProps {
  role: ModelRole;
  models: ModelDescription[];
  selectedModel: ModelDescription | null;
  onSelect: (model: ModelDescription | null) => void;
  displayName: string;
  description: string | ReactNode;
  hideTitle?: boolean;
  onConfigureModel?: (model: ModelDescription) => void;
}

const ModelRoleSelector = ({
  role: _role,
  models,
  selectedModel,
  onSelect,
  displayName,
  description,
  hideTitle = false,
  onConfigureModel,
}: ModelRoleSelectorProps) => {
  const noConfiguredModels = models.every(
    (model) => model.configurationStatus !== LLMConfigurationStatuses.VALID,
  );

  function handleSelect(title: string | null) {
    onSelect(models.find((m) => m.title === title) ?? null);
  }

  function handleInvalidOptionClick(
    model: ModelDescription,
    e: MouseEvent<HTMLLIElement>,
  ) {
    e.preventDefault();
    e.stopPropagation();
    onConfigureModel?.(model);
  }

  return (
    <>
      {!hideTitle && (
        <div className="mt-2 flex flex-row items-center gap-1 sm:mt-0">
          <span style={{ fontSize: fontSize(-1) }}>{displayName}</span>
          <InfoHover size="3" id={displayName} msg={description} />
        </div>
      )}

      <Listbox value={selectedModel?.title ?? null} onChange={handleSelect}>
        <div className="relative">
          <ListboxButton
            className="hover:bg-list-active hover:text-list-active-foreground flex h-8 w-full items-center justify-between border-[color:var(--vscode-sideBar-border,rgba(128,128,128,0.22))] px-2.5"
          >
            {noConfiguredModels ? (
              <span className="text-description line-clamp-1 text-xs italic">
                {`No valid ${displayName.toLowerCase()} models${
                  ["Chat", "Apply", "Edit"].includes(displayName)
                    ? " — using Chat model"
                    : ""
                }`}
              </span>
            ) : (
              <span
                className="line-clamp-1"
                style={{ fontSize: fontSize(-1) }}
              >
                {selectedModel?.title ?? `Select ${displayName} model`}
              </span>
            )}

            <ChevronUpDownIcon
              className="text-description h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />
          </ListboxButton>

          <Transition>
            <ListboxOptions
              style={{ borderRadius: defaultBorderRadius }}
              className="min-w-40"
            >
              {[...models]
                .sort((a, b) => a.title.localeCompare(b.title))
                .map((option) => {
                  const isConfigInvalid =
                    option.configurationStatus !==
                    LLMConfigurationStatuses.VALID;
                  let invalidMessage = "(Invalid config)";
                  if (
                    option.configurationStatus ===
                    LLMConfigurationStatuses.MISSING_ENV_SECRET
                  ) {
                    invalidMessage = "(Missing env secret)";
                  }
                  if (
                    option.configurationStatus ===
                    LLMConfigurationStatuses.MISSING_API_KEY
                  ) {
                    invalidMessage = "(Missing API Key)";
                  }

                  return (
                    <ListboxOption
                      key={option.title}
                      value={option.title}
                      onClick={(e: MouseEvent<HTMLLIElement>) => {
                        if (isConfigInvalid) {
                          handleInvalidOptionClick(option, e);
                        }
                      }}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <CubeIcon className="h-3 w-3 flex-shrink-0" />
                          <span
                            className="line-clamp-1 truncate"
                            style={{ fontSize: fontSize(-1) }}
                          >
                            {option.title}
                            {isConfigInvalid && (
                              <span className="ml-2 text-[10px] italic">
                                {invalidMessage}
                              </span>
                            )}
                          </span>
                        </div>

                        <div className="flex-shrink-0">
                          {option.title === selectedModel?.title && (
                            <CheckIcon className="h-3 w-3" />
                          )}
                        </div>
                      </div>
                    </ListboxOption>
                  );
                })}
            </ListboxOptions>
          </Transition>
        </div>
      </Listbox>
    </>
  );
};

export default ModelRoleSelector;
