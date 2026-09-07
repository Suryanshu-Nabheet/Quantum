import { TabAutocompleteOptions } from "../index.js";

export const DEFAULT_AUTOCOMPLETE_OPTS: TabAutocompleteOptions = {
  disable: false,
  maxPromptTokens: 4096,
  prefixPercentage: 0.75,
  maxSuffixPercentage: 0.25,
  debounceDelay: 0,
  modelTimeout: 6000,
  multilineCompletions: "auto",
  useCache: true,
  onlyMyCode: true,
  useRecentlyOpened: true,
  disableInFiles: undefined,
  transform: true,
  showWhateverWeHaveAtXMs: 150,
  experimental_includeDiff: true,
};

export const COUNT_COMPLETION_REJECTED_AFTER = 10_000;
export const DO_NOT_COUNT_REJECTED_BEFORE = 250;
