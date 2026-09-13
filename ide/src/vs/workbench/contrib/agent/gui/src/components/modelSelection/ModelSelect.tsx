import {
  ArrowPathIcon,
  CheckIcon,
  ChevronDownIcon,
  Cog6ToothIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AddModelForm } from "../../forms/AddModelForm";
import { useWebviewListener } from "../../hooks/useWebviewListener";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectSelectedProfile } from "../../redux/slices/profilesSlice";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";
import { updateSelectedModelByRole } from "../../redux/thunks/updateSelectedModelByRole";
import { getMetaKeyLabel, isMetaEquivalentKeyPressed } from "../../util";
import {
  formatModelLabel,
  getModelDisplayId,
  getProviderDisplayName,
} from "../../util/modelDisplay";
import { CONFIG_ROUTES } from "../../util/navigation";
import {
  Button,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  useFontSize,
} from "../ui";
import { Divider } from "../ui/Divider";
import { TextShimmer } from "../core/text-shimmer";
import { HAIRLINE_BORDER_B } from "../../styles/borders";

interface Option {
  value: string;
  /** Full searchable label: Provider · model */
  title: string;
  modelId: string;
  providerLabel: string;
  apiKey?: string;
  sourceFile?: string;
}

interface ModelOptionProps {
  option: Option;
  idx: number;
  showMissingApiKeyMsg: boolean;
  isSelected?: boolean;
  isHighlighted?: boolean;
  optionRef?: (el: HTMLElement | null) => void;
}

/**makeshift way to close the headlessui listbox due to absence of open state on the listbox */
function closeDropDown(button: HTMLButtonElement | null) {
  if (!button) return;
  button.classList.add("hidden");
  setTimeout(() => {
    button.classList.remove("hidden");
  });
}

function ListboxOpenEffect({
  open,
  onOpen,
  onClose,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      onOpen();
    }
    if (!open && wasOpen.current) {
      onClose();
    }
    wasOpen.current = open;
  }, [open, onOpen, onClose]);
  return null;
}

function ModelOption({
  option,
  idx,
  showMissingApiKeyMsg,
  isSelected,
  isHighlighted,
  optionRef,
}: ModelOptionProps) {
  const navigate = useNavigate();

  function handleOptionClick(e: React.MouseEvent) {
    if (showMissingApiKeyMsg) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function handleConfigureClick(e: React.MouseEvent) {
    e.stopPropagation();
    navigate(CONFIG_ROUTES.MODELS);
  }

  return (
    <ListboxOption
      key={idx}
      ref={optionRef as any}
      disabled={showMissingApiKeyMsg}
      value={option.value}
      onClick={handleOptionClick}
      className={`group ${
        isHighlighted || isSelected
          ? "bg-list-active text-list-active-foreground"
          : ""
      }`}
    >
      <div className="flex w-full min-w-0 items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 py-0.5">
          <span className="line-clamp-1 font-medium">{option.modelId}</span>
          {showMissingApiKeyMsg && (
            <span className="text-description-muted shrink-0 text-[10px] italic">
              (Missing API key)
            </span>
          )}
        </div>
        <span className="text-description-muted line-clamp-1 shrink-0 text-[11px]">
          {option.providerLabel}
        </span>
        {isSelected ? (
          <CheckIcon className="text-foreground h-3.5 w-3.5 shrink-0" />
        ) : (
          <Button
            variant="ghost"
            size="sm"
            tooltip="Configure provider"
            className="text-description-muted hover:enabled:text-foreground my-0 h-4 w-4 shrink-0 p-0 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={handleConfigureClick}
          >
            <Cog6ToothIcon className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </ListboxOption>
  );
}

function ModelSelect() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const isInEdit = useAppSelector((store) => store.session.isInEdit);
  const config = useAppSelector((state) => state.config.config);
  const isConfigLoading = useAppSelector((state) => state.config.loading);
  const selectedProfile = useAppSelector(selectSelectedProfile);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionElsRef = useRef<Map<number, HTMLElement>>(new Map());
  const pickerOpenRef = useRef(false);
  const [options, setOptions] = useState<Option[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [openRequestId, setOpenRequestId] = useState(0);
  const tinyFont = useFontSize(-4);

  let selectedModel = null;
  let allModels = null;
  if (isInEdit) {
    allModels = config.modelsByRole.edit;
    selectedModel = config.selectedModelByRole.edit;
  }
  if (!selectedModel) {
    selectedModel = config.selectedModelByRole.chat;
  }
  if (!allModels || allModels.length === 0) {
    allModels = config.modelsByRole.chat;
  }

  useEffect(() => {
    setOptions(
      allModels.map((model) => {
        const providerLabel = getProviderDisplayName(
          model.underlyingProviderName || model.provider,
        );
        const modelId = getModelDisplayId(model);
        return {
          value: model.title,
          title: formatModelLabel(model),
          modelId: modelId || model.title,
          providerLabel,
          apiKey: model.apiKey,
          sourceFile: model.sourceFile,
        };
      }),
    );
  }, [allModels]);

  const sortedOptions = useMemo(() => {
    const alphaSort = [...options].sort((a, b) =>
      a.title.localeCompare(b.title),
    );
    const enabledOptions = alphaSort.filter((option) => option.apiKey !== "");
    const disabledOptions = alphaSort.filter((option) => option.apiKey === "");
    return [...enabledOptions, ...disabledOptions];
  }, [options]);

  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return sortedOptions;
    }
    return sortedOptions.filter((option) => {
      return (
        option.title.toLowerCase().includes(q) ||
        option.modelId.toLowerCase().includes(q) ||
        option.providerLabel.toLowerCase().includes(q) ||
        option.value.toLowerCase().includes(q)
      );
    });
  }, [sortedOptions, searchQuery]);

  const selectableOptions = useMemo(
    () => filteredOptions.filter((option) => option.apiKey !== ""),
    [filteredOptions],
  );

  // Prefer the current selection when the picker opens; clamp when the filter shrinks.
  useEffect(() => {
    if (!pickerOpen) {
      return;
    }
    const selectedIdx = selectableOptions.findIndex(
      (o) => o.value === selectedModel?.title,
    );
    setHighlightIndex(selectedIdx >= 0 ? selectedIdx : 0);
    // Only when open flips true — not on every filter/selection change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerOpen]);

  useEffect(() => {
    setHighlightIndex((prev) => {
      if (selectableOptions.length === 0) {
        return 0;
      }
      return Math.min(prev, selectableOptions.length - 1);
    });
  }, [selectableOptions.length]);

  useEffect(() => {
    const el = optionElsRef.current.get(highlightIndex);
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex]);

  const selectModelByTitle = useCallback(
    (modelTitle: string) => {
      if (!selectedProfile) {
        return;
      }
      if (modelTitle === selectedModel?.title) {
        closeDropDown(buttonRef.current);
        return;
      }
      void dispatch(
        updateSelectedModelByRole({
          selectedProfile,
          role: isInEdit ? "edit" : "chat",
          modelTitle,
        }),
      );
      closeDropDown(buttonRef.current);
    },
    [dispatch, isInEdit, selectedModel?.title, selectedProfile],
  );

  const requestOpenPicker = useCallback(() => {
    setOpenRequestId((id) => id + 1);
  }, []);

  // Reliably open (or focus) the Headless listbox after ⌘+/ / IDE command.
  useEffect(() => {
    if (openRequestId === 0) {
      return;
    }
    const button = buttonRef.current;
    if (!button) {
      return;
    }
    const alreadyOpen =
      pickerOpenRef.current ||
      button.getAttribute("aria-expanded") === "true";
    if (alreadyOpen) {
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      });
      return;
    }
    // Defer past the keydown so Headless UI accepts the synthetic click.
    const timer = window.setTimeout(() => {
      button.click();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [openRequestId]);

  useWebviewListener(
    "openModelPicker",
    async () => {
      requestOpenPicker();
    },
    [requestOpenPicker],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isMetaEquivalentKeyPressed(event as any)) {
        return;
      }
      if (event.altKey || event.shiftKey) {
        return;
      }

      // ⌘/' — cycle selected model
      if (event.key === "'") {
        if (!selectedProfile) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const currentIndex = options.findIndex(
          (option) => option.value === selectedModel?.title,
        );
        if (options.length === 0) return;
        let nextIndex = (currentIndex + 1) % options.length;
        if (nextIndex < 0) nextIndex = options.length - 1;
        const newModelTitle = options[nextIndex].value;

        void dispatch(
          updateSelectedModelByRole({
            selectedProfile,
            role: "chat",
            modelTitle: newModelTitle,
          }),
        );
        return;
      }

      // ⌘+/ — open / toggle model picker (search focused).
      // Prefer event.code: with Meta held, event.key is unreliable in Electron.
      if (event.code === "Slash" || event.key === "/") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        const button = buttonRef.current;
        const alreadyOpen =
          pickerOpenRef.current ||
          button?.getAttribute("aria-expanded") === "true";
        if (alreadyOpen) {
          closeDropDown(button);
        } else {
          requestOpenPicker();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [options, selectedModel, selectedProfile, dispatch, requestOpenPicker]);

  const handlePickerOpen = useCallback(() => {
    setSearchQuery("");
    setPickerOpen(true);
    pickerOpenRef.current = true;
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  }, []);

  const handlePickerClose = useCallback(() => {
    setSearchQuery("");
    setPickerOpen(false);
    pickerOpenRef.current = false;
    setHighlightIndex(0);
  }, []);

  function onClickAddModel(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();

    closeDropDown(buttonRef.current);

    dispatch(setShowDialog(true));
    dispatch(
      setDialogMessage(
        <AddModelForm
          formTitle="Add provider"
          onDone={() => {
            dispatch(setShowDialog(false));
          }}
        />,
      ),
    );
  }

  function onClickConfigureModels(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();

    closeDropDown(buttonRef.current);

    navigate(CONFIG_ROUTES.MODELS);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      if (selectableOptions.length === 0) return;
      setHighlightIndex((i) => (i + 1) % selectableOptions.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      if (selectableOptions.length === 0) return;
      setHighlightIndex(
        (i) => (i - 1 + selectableOptions.length) % selectableOptions.length,
      );
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      const target =
        selectableOptions[highlightIndex] ?? selectableOptions[0];
      if (target) {
        selectModelByTitle(target.value);
      }
      return;
    }
    // Keep typing in the field; let Escape / Tab bubble to Headless for close/focus.
    if (e.key !== "Escape" && e.key !== "Tab") {
      e.stopPropagation();
    }
  }

  const hasNoModels = allModels?.length === 0;
  const meta = getMetaKeyLabel();

  return (
    <Listbox
      onChange={async (val: string) => {
        if (val === "addModel") return;
        selectModelByTitle(val);
      }}
    >
      {({ open }) => (
        <div className="relative flex">
          <ListboxOpenEffect
            open={open}
            onOpen={handlePickerOpen}
            onClose={handlePickerClose}
          />
          <ListboxButton
            data-testid="model-select-button"
            ref={buttonRef}
            className="text-description h-[18px] gap-1 border-none"
          >
            <span className="line-clamp-1 break-all hover:brightness-110">
              {selectedModel
                ? getModelDisplayId(selectedModel) ||
                  formatModelLabel(selectedModel)
                : "Select model"}
            </span>
            <ChevronDownIcon
              className="hidden h-2 w-2 flex-shrink-0 hover:brightness-110 min-[200px]:flex"
              aria-hidden="true"
            />
          </ListboxButton>
          <ListboxOptions className="min-w-[220px] max-w-[320px]">
            <div
              className={`border-0 border-b border-solid ${HAIRLINE_BORDER_B} px-2 py-1.5`}
            >
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                placeholder="Search models"
                aria-label="Search models"
                autoComplete="off"
                spellCheck={false}
                className="text-foreground placeholder-description-muted w-full border-none bg-transparent text-xs outline-none placeholder:text-[color:var(--vscode-descriptionForeground)] placeholder:opacity-50"
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setHighlightIndex(0);
                }}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={handleSearchKeyDown}
              />
            </div>

            <div className="flex items-center justify-between px-1.5 py-1">
              <span className="text-description text-xs font-medium">
                Models
              </span>
              <Button
                tooltip="Configure providers"
                onClick={(e) => {
                  e.stopPropagation();
                  onClickConfigureModels(e);
                }}
                variant="ghost"
                size="sm"
                className="my-0 h-5 w-5 p-0"
              >
                <Cog6ToothIcon className="text-description h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="no-scrollbar max-h-[300px] overflow-y-auto">
              {isConfigLoading ? (
                <div className="flex items-center gap-2 px-2 pb-2 pt-1">
                  <ArrowPathIcon className="animate-spin-slow text-description h-3 w-3" />
                  <TextShimmer>Loading config</TextShimmer>
                </div>
              ) : hasNoModels ? (
                <div className="text-description-muted px-2 py-4 text-center text-sm">
                  No providers configured
                </div>
              ) : filteredOptions.length === 0 ? (
                <div className="text-description-muted px-2 py-4 text-center text-sm">
                  No models found
                </div>
              ) : (
                filteredOptions.map((option, idx) => {
                  const selectableIdx = selectableOptions.findIndex(
                    (o) => o.value === option.value,
                  );
                  const isHighlighted =
                    selectableIdx >= 0 && selectableIdx === highlightIndex;
                  return (
                    <ModelOption
                      option={option}
                      idx={idx}
                      key={option.value}
                      showMissingApiKeyMsg={option.apiKey === ""}
                      isSelected={option.value === selectedModel?.title}
                      isHighlighted={isHighlighted}
                      optionRef={
                        selectableIdx >= 0
                          ? (el) => {
                              if (el) {
                                optionElsRef.current.set(selectableIdx, el);
                              } else {
                                optionElsRef.current.delete(selectableIdx);
                              }
                            }
                          : undefined
                      }
                    />
                  );
                })
              )}
            </div>

            {!isConfigLoading && (
              <>
                <Divider className="!mb-0" />
                <ListboxOption
                  key="add-provider"
                  onClick={onClickAddModel}
                  value={"addModel" as any}
                  fontSizeModifier={-2}
                  className="px-2 py-2"
                >
                  <span className="text-description text-2xs flex flex-row items-center">
                    <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
                    Add provider
                  </span>
                </ListboxOption>

                <Divider className="!my-0" />
                <div className="text-description flex flex-col gap-0.5 px-2 py-1.5">
                  <span className="block" style={{ fontSize: tinyFont }}>
                    <code>{meta}'</code> cycle model
                  </span>
                  <span className="block" style={{ fontSize: tinyFont }}>
                    <code>{meta}/</code> search models
                  </span>
                </div>
              </>
            )}
          </ListboxOptions>
        </div>
      )}
    </Listbox>
  );
}

export default ModelSelect;
