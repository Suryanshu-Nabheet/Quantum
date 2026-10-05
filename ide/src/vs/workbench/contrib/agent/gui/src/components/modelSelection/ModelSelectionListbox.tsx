import {
  CheckIcon,
  ChevronUpDownIcon,
  CubeIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from "../../components/ui";
import { DisplayInfo } from "../../pages/AddNewModel/configs/models";
import { HAIRLINE_BORDER } from "../../styles/borders";
import { providerLogoUrl } from "../../util/mediaUrl";
import { cn } from "../../util/cn";

interface ModelSelectionListboxProps {
  /** Model selection listbox for choosing AI providers */
  selectedProvider: DisplayInfo;
  setSelectedProvider: (val: DisplayInfo) => void;
  topOptions?: DisplayInfo[];
  otherOptions?: DisplayInfo[];
  searchPlaceholder?: string;
}

/**
 * Simple fuzzy search algorithm
 * Returns a score based on how well the query matches the text
 */
function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  if (!q) return 1; // Empty query matches everything
  if (!t) return 0;

  let score = 0;
  let queryIdx = 0;
  let lastMatchIdx = -1;

  for (let i = 0; i < t.length && queryIdx < q.length; i++) {
    if (t[i] === q[queryIdx]) {
      score += 1 + (lastMatchIdx === i - 1 ? 5 : 0); // Bonus for consecutive matches
      lastMatchIdx = i;
      queryIdx++;
    }
  }

  // Return 0 if not all query characters were found
  return queryIdx === q.length ? score / t.length : 0;
}

function ModelSelectionListbox({
  selectedProvider,
  setSelectedProvider,
  topOptions = [],
  otherOptions = [],
  searchPlaceholder = "Search models...",
}: ModelSelectionListboxProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuWidth, setMenuWidth] = useState<number>();

  useLayoutEffect(() => {
    const el = buttonRef.current;
    if (!el) {
      return;
    }
    const syncWidth = () => {
      setMenuWidth(el.getBoundingClientRect().width);
    };
    syncWidth();
    const observer = new ResizeObserver(syncWidth);
    observer.observe(el);
    window.addEventListener("resize", syncWidth);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncWidth);
    };
  }, []);

  // Clear search query when provider changes
  useEffect(() => {
    setSearchQuery("");
  }, [selectedProvider]);

  // Combine and filter options based on fuzzy search
  const filteredTopOptions = useMemo(() => {
    if (!searchQuery) return topOptions;
    return topOptions
      .map((opt) => ({
        option: opt,
        score: fuzzyScore(searchQuery, opt.title),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ option }) => option);
  }, [searchQuery, topOptions]);

  const filteredOtherOptions = useMemo(() => {
    if (!searchQuery) return otherOptions;
    return otherOptions
      .map((opt) => ({
        option: opt,
        score: fuzzyScore(searchQuery, opt.title),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ option }) => option);
  }, [searchQuery, otherOptions]);

  const hasResults =
    filteredTopOptions.length > 0 || filteredOtherOptions.length > 0;

  return (
    <Listbox
      value={selectedProvider}
      onChange={(value) => {
        setSelectedProvider(value);
        setSearchQuery("");
      }}
    >
      <div className="relative mt-1 w-full min-w-0">
        <ListboxButton
          ref={buttonRef}
          className={cn(
            "bg-vsc-input-background text-foreground hover:bg-input relative m-0 !flex-none grid min-h-9 w-full min-w-0 cursor-pointer grid-cols-[1fr_auto] items-center rounded-lg border border-solid py-2 pl-3 pr-10 text-left focus:outline-none",
            HAIRLINE_BORDER,
          )}
        >
          <span className="flex items-center">
            {providerLogoUrl(selectedProvider.icon) && (
              <img
                src={providerLogoUrl(selectedProvider.icon)}
                className="mr-3 h-4 w-4 object-contain object-center"
                alt=""
              />
            )}
            <span className="text-xs">{selectedProvider.title}</span>
          </span>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <ChevronUpDownIcon
              className="text-description-muted h-5 w-5"
              aria-hidden="true"
            />
          </span>
        </ListboxButton>

        <Transition
          as={Fragment}
          leave="transition ease-out duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <ListboxOptions
            matchTriggerWidth={menuWidth === undefined}
            style={
              menuWidth !== undefined
                ? {
                    width: menuWidth,
                    minWidth: menuWidth,
                    maxWidth: menuWidth,
                  }
                : undefined
            }
            className={cn(
              "bg-input rounded-default flex max-h-[min(30vh,280px)] flex-col overflow-hidden p-0 focus:outline-none",
              menuWidth !== undefined && "!w-auto !min-w-0 !max-w-none",
              "[--anchor-gap:0.25rem]",
            )}
          >
            {/* Search Box */}
            <div className="border-border shrink-0 border-b p-2">
              <div className="bg-background border-border flex min-w-0 items-center rounded border pl-2">
                <MagnifyingGlassIcon className="text-description-muted h-4 w-4 shrink-0" />
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-background text-foreground placeholder-description-muted min-w-0 flex-1 border-0 px-2 py-1.5 text-xs outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            {/* Results */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {!hasResults ? (
                <div className="text-description-muted px-3 py-4 text-center text-xs">
                  No models found matching "{searchQuery}"
                </div>
              ) : (
                <>
                  {filteredTopOptions.length > 0 && (
                    <div className="py-1">
                      <div className="text-description-muted px-3 py-1 text-xs font-medium uppercase tracking-wider">
                        Popular
                      </div>
                      {filteredTopOptions.map((option, index) => (
                        <ListboxOption
                          key={index}
                          className={({ selected }: { selected: boolean }) =>
                            ` ${selected ? "bg-list-active" : "bg-input"} hover:bg-list-active hover:text-list-active-foreground relative flex cursor-pointer select-none items-center justify-between gap-2 p-1.5 px-3 py-2 pr-4`
                          }
                          value={option}
                        >
                          {({ selected }) => (
                            <>
                              <div className="flex items-center">
                                {option.title === "Autodetect" ? (
                                  <CubeIcon className="mr-2 h-4 w-4" />
                                ) : (
                                  providerLogoUrl(option.icon) && (
                                    <img
                                      src={providerLogoUrl(option.icon)}
                                      className="mr-2 h-4 w-4 object-contain object-center"
                                      alt=""
                                    />
                                  )
                                )}
                                <span className="text-xs">{option.title}</span>
                              </div>
                              {selected && (
                                <CheckIcon
                                  className="h-3 w-3"
                                  aria-hidden="true"
                                />
                              )}
                            </>
                          )}
                        </ListboxOption>
                      ))}
                    </div>
                  )}
                  {filteredTopOptions.length > 0 &&
                    filteredOtherOptions.length > 0 && (
                      <div className="bg-border my-1 h-px min-h-px" />
                    )}
                  {filteredOtherOptions.length > 0 && (
                    <div className="py-1">
                      <div className="text-description-muted px-3 py-1 text-xs font-medium uppercase tracking-wider">
                        Additional providers
                      </div>
                      {filteredOtherOptions.map((option, index) => (
                        <ListboxOption
                          key={index}
                          className={({ selected }: { selected: boolean }) =>
                            ` ${selected ? "bg-list-active" : "bg-input"} hover:bg-list-active hover:text-list-active-foreground relative flex cursor-pointer select-none items-center justify-between gap-2 p-1.5 px-3 py-2 pr-4`
                          }
                          value={option}
                        >
                          {({ selected }) => (
                            <>
                              <div className="flex items-center">
                                {option.title === "Autodetect" ? (
                                  <CubeIcon className="mr-2 h-4 w-4" />
                                ) : (
                                  providerLogoUrl(option.icon) && (
                                    <img
                                      src={providerLogoUrl(option.icon)}
                                      className="mr-2 h-4 w-4 object-contain object-center"
                                      alt=""
                                    />
                                  )
                                )}
                                <span className="text-xs">{option.title}</span>
                              </div>

                              {selected && (
                                <CheckIcon
                                  className="h-3 w-3"
                                  aria-hidden="true"
                                />
                              )}
                            </>
                          )}
                        </ListboxOption>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </ListboxOptions>
        </Transition>
      </div>
    </Listbox>
  );
}

export default ModelSelectionListbox;
