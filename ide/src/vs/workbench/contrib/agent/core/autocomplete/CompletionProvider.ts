import { ConfigHandler } from "../config/ConfigHandler.js";
import { CompletionOptions, ILLM, TabAutocompleteOptions } from "../index.js";
import OpenAI from "../llm/llms/OpenAI.js";
import { DEFAULT_AUTOCOMPLETE_OPTS } from "../util/parameters.js";

import { isSecurityConcern } from "../indexing/ignore.js";
import { getGlobalContextFilePath } from "../util/paths.js";
import { postprocessCompletion } from "./postprocessing/index.js";
import { AutocompleteLoggingService } from "./AutocompleteLoggingService.js";
import { languageForFilepath } from "./constants/AutocompleteLanguageInfo.js";
import { AutocompleteDebouncer } from "./util/AutocompleteDebouncer.js";
import { AutocompleteInflight } from "./util/AutocompleteInflight.js";
import AutocompleteLruCache from "./util/AutocompleteLruCache.js";
import { AutocompleteInput, AutocompleteOutcome } from "./util/types.js";

export type AutocompleteHandlers = {
  onPartial?: (completion: string) => void;
};

const AUTOCOMPLETE_MAX_OUTPUT_TOKENS = 512;

const autocompleteCachePromise = AutocompleteLruCache.get();

const ERRORS_TO_IGNORE = [
  "unexpected server status",
  "operation was aborted",
  "This operation was aborted",
];

function hashString(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function selectedCompletionKey(input: AutocompleteInput): string {
  const selected = input.selectedCompletionInfo;
  if (!selected) {
    return "none";
  }
  return [
    hashString(selected.text),
    selected.range.start.line,
    selected.range.start.character,
    selected.range.end.line,
    selected.range.end.character,
  ].join(":");
}

function cacheKey({
  filepath,
  prefix,
  suffix,
  llm,
  options,
  selectedKey,
}: {
  filepath: string;
  prefix: string;
  suffix: string;
  llm: ILLM;
  options: TabAutocompleteOptions;
  selectedKey: string;
}): string {
  return [
    filepath,
    llm.uniqueId,
    llm.model,
    hashString(prefix),
    hashString(suffix),
    options.multilineCompletions,
    options.transform ? "transform" : "raw",
    selectedKey,
  ].join("\0");
}

function applyQualityFloors(
  options: TabAutocompleteOptions,
): TabAutocompleteOptions {
  const merged = { ...options };
  if (merged.modelTimeout < 2000) {
    merged.modelTimeout = DEFAULT_AUTOCOMPLETE_OPTS.modelTimeout;
  }
  if ((merged.showWhateverWeHaveAtXMs ?? 0) < 200) {
    merged.showWhateverWeHaveAtXMs =
      DEFAULT_AUTOCOMPLETE_OPTS.showWhateverWeHaveAtXMs;
  }
  if (merged.maxPromptTokens < 1024) {
    merged.maxPromptTokens = DEFAULT_AUTOCOMPLETE_OPTS.maxPromptTokens;
  }
  return merged;
}

function createTimeoutSignal(
  parent: AbortSignal,
  timeoutMs: number,
): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  parent.addEventListener("abort", abort, { once: true });
  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timeout);
      parent.removeEventListener("abort", abort);
    },
  };
}

export class CompletionProvider {
  private autocompleteCache?: AutocompleteLruCache;
  public errorsShown: Set<string> = new Set();
  private noModelWarned = false;
  private loggingService = AutocompleteLoggingService.getInstance();
  private debouncer = new AutocompleteDebouncer();
  private cachedTabOptions?: {
    profileId: string;
    base: TabAutocompleteOptions;
  };

  constructor(
    private readonly configHandler: ConfigHandler,
    private readonly _injectedGetLlm: () => Promise<ILLM | undefined>,
    private readonly _onError: (e: any) => void,
  ) {
    void this.initCache();
  }

  private async initCache() {
    try {
      this.autocompleteCache = await autocompleteCachePromise;
    } catch (e) {
      console.error("Failed to initialize autocomplete cache:", e);
    }
  }

  private async getCache(): Promise<AutocompleteLruCache> {
    if (!this.autocompleteCache) {
      this.autocompleteCache = await autocompleteCachePromise;
    }
    return this.autocompleteCache;
  }

  private async _prepareLlm(): Promise<ILLM | undefined> {
    const llm = await this._injectedGetLlm();
    if (!llm) {
      if (!this.noModelWarned) {
        this.noModelWarned = true;
        this._onError(
          new Error(
            "No autocomplete model selected. Choose one in Agent settings → Models.",
          ),
        );
      }
      return undefined;
    }

    if (llm.providerName === "mistral" && llm.apiKey === "") {
      return undefined;
    }

    if (llm.completionOptions.temperature === undefined) {
      llm.completionOptions.temperature = 0.01;
    }

    if (llm instanceof OpenAI) {
      llm.useLegacyCompletionsEndpoint = true;
    }

    return llm;
  }

  private onError(e: any) {
    if (
      ERRORS_TO_IGNORE.some((err) =>
        typeof e === "string" ? e.includes(err) : e?.message?.includes(err),
      )
    ) {
      return;
    }

    console.warn("Error generating autocompletion: ", e);
    if (!this.errorsShown.has(e.message)) {
      this.errorsShown.add(e.message);
      this._onError(e);
    }
  }

  public cancel() {
    this.loggingService.cancel();
  }

  public accept(completionId: string) {
    this.loggingService.accept(completionId);
  }

  public markDisplayed(completionId: string, outcome: AutocompleteOutcome) {
    this.loggingService.markDisplayed(completionId, outcome);
  }

  private async _getAutocompleteOptions(
    llm: ILLM,
  ): Promise<TabAutocompleteOptions> {
    const profileId =
      this.configHandler.currentProfile?.profileDescription.id ?? "";

    let base: TabAutocompleteOptions;
    if (this.cachedTabOptions?.profileId === profileId) {
      base = this.cachedTabOptions.base;
    } else {
      const { config } = await this.configHandler.loadConfig();
      base = {
        ...DEFAULT_AUTOCOMPLETE_OPTS,
        ...config?.tabAutocompleteOptions,
      };
      this.cachedTabOptions = { profileId, base };
    }

    return applyQualityFloors({
      ...base,
      ...llm.autocompleteOptions,
    });
  }

  public async provideLightweightInlineCompletionItems(
    input: AutocompleteInput,
    token: AbortSignal | undefined,
    force?: boolean,
    handlers?: AutocompleteHandlers,
  ): Promise<AutocompleteOutcome | undefined> {
    if (!token) {
      const controller = new AbortController();
      token = controller.signal;
    }

    const llm = await this._prepareLlm();
    if (!llm || isSecurityConcern(input.filepath)) {
      return undefined;
    }

    const options = await this._getAutocompleteOptions(llm);

    if (
      input.manuallyPassPrefix === undefined ||
      input.manuallyPassSuffix === undefined
    ) {
      return undefined;
    }

    if (this.shouldPrefilterLightweight(input, options)) {
      return undefined;
    }

    const selectedKey = selectedCompletionKey(input);
    const contextKey = cacheKey({
      filepath: input.filepath,
      prefix: input.manuallyPassPrefix,
      suffix: input.manuallyPassSuffix,
      llm,
      options,
      selectedKey,
    });
    const inflightKey = AutocompleteInflight.key(
      input.filepath,
      input.pos.line,
      input.pos.character,
      contextKey,
    );
    const inflight = AutocompleteInflight.get(inflightKey);
    if (inflight) {
      return inflight;
    }

    return AutocompleteInflight.track(
      inflightKey,
      llm.supportsFim()
        ? this.completeViaLightweightFim(token, force, llm, options, input, handlers)
        : this.completeViaLightweightPrompt(token, force, llm, options, input, handlers),
    );
  }

  private shouldPrefilterLightweight(
    input: AutocompleteInput,
    options: TabAutocompleteOptions,
  ): boolean {
    if (options.disable) {
      return true;
    }

    if (input.filepath === getGlobalContextFilePath()) {
      return true;
    }

    if (
      input.isUntitledFile &&
      `${input.manuallyPassPrefix ?? ""}${input.manuallyPassSuffix ?? ""}`.trim()
        .length === 0
    ) {
      return true;
    }

    return false;
  }

  private shouldCompleteMultilineLightweight(
    input: AutocompleteInput,
    options: TabAutocompleteOptions,
  ): boolean {
    switch (options.multilineCompletions) {
      case "always":
        return true;
      case "never":
        return false;
      default:
        break;
    }

    if (input.selectedCompletionInfo) {
      return false;
    }

    const lang = languageForFilepath(input.filepath);
    const prefix = input.manuallyPassPrefix ?? "";
    if (
      lang.singleLineComment &&
      prefix.split("\n").slice(-1)[0]?.trimStart().startsWith(
        lang.singleLineComment,
      )
    ) {
      return false;
    }

    return (
      lang.useMultiline?.({
        prefix,
        suffix: input.manuallyPassSuffix ?? "",
      }) ?? true
    );
  }

  private async completeViaLightweightFim(
    token: AbortSignal,
    force: boolean | undefined,
    llm: ILLM,
    options: TabAutocompleteOptions,
    input: AutocompleteInput,
    handlers?: AutocompleteHandlers,
  ): Promise<AutocompleteOutcome | undefined> {
    const timeoutSignal = createTimeoutSignal(token, options.modelTimeout);
    try {
      const startTime = Date.now();
      const prefix = input.manuallyPassPrefix ?? "";
      const suffix = input.manuallyPassSuffix ?? "";
      const prefixCacheKey = cacheKey({
        filepath: input.filepath,
        prefix,
        suffix,
        llm,
        options,
        selectedKey: selectedCompletionKey(input),
      });
      const cache = await this.getCache();

      if (options.useCache) {
        const cached = await cache.get(prefixCacheKey);
        if (cached) {
          return this.buildOutcome({
            completion: cached,
            prefix,
            suffix,
            prompt: "",
            llm,
            options,
            startTime,
            cacheHit: true,
            filepath: input.filepath,
            completionId: input.completionId,
          });
        }
      }

      if (
        !force &&
        options.debounceDelay > 0 &&
        (await this.debouncer.delayAndShouldDebounce(options.debounceDelay))
      ) {
        return undefined;
      }

      const streamOptions = {
        maxTokens: AUTOCOMPLETE_MAX_OUTPUT_TOKENS,
        temperature: 0.01,
        stop: llm.completionOptions.stop,
      };

      let completion: string | undefined = "";
      for await (const update of llm.streamFim(
        prefix,
        suffix,
        timeoutSignal.signal,
        streamOptions,
      )) {
        if (token.aborted || timeoutSignal.signal.aborted) {
          return undefined;
        }
        completion += update;
        if (update && handlers?.onPartial) {
          handlers.onPartial(completion);
        }
        if (!this.shouldCompleteMultilineLightweight(input, options)) {
          const firstLine: string = completion.split("\n")[0] ?? "";
          if (firstLine !== completion) {
            completion = firstLine;
            break;
          }
        }
      }

      if (token.aborted || timeoutSignal.signal.aborted) {
        return undefined;
      }

      const rawCompletion = completion;
      completion = options.transform
        ? postprocessCompletion({
          completion: completion ?? "",
          prefix,
          suffix,
          llm,
        })
        : completion;

      if (!completion && rawCompletion?.trim()) {
        completion = rawCompletion;
      }

      if (!completion) {
        return undefined;
      }

      const outcome = this.buildOutcome({
        completion,
        prefix,
        suffix,
        prompt: "",
        llm,
        options,
        startTime,
        cacheHit: false,
        completionOptions: streamOptions,
        filepath: input.filepath,
        completionId: input.completionId,
      });

      if (options.useCache) {
        void cache
          .put(prefixCacheKey, outcome.completion)
          .catch((e) => console.warn(`Failed to save to cache: ${e.message}`));
      }

      return outcome;
    } catch (e: any) {
      this.onError(e);
      return undefined;
    } finally {
      timeoutSignal.dispose();
    }
  }

  private async completeViaLightweightPrompt(
    token: AbortSignal,
    force: boolean | undefined,
    llm: ILLM,
    options: TabAutocompleteOptions,
    input: AutocompleteInput,
    handlers?: AutocompleteHandlers,
  ): Promise<AutocompleteOutcome | undefined> {
    const timeoutSignal = createTimeoutSignal(token, options.modelTimeout);
    try {
      const startTime = Date.now();
      const prefix = input.manuallyPassPrefix ?? "";
      const suffix = input.manuallyPassSuffix ?? "";
      const prefixCacheKey = cacheKey({
        filepath: input.filepath,
        prefix,
        suffix,
        llm,
        options,
        selectedKey: selectedCompletionKey(input),
      });
      const cache = await this.getCache();

      if (options.useCache) {
        const cached = await cache.get(prefixCacheKey);
        if (cached) {
          return this.buildOutcome({
            completion: cached,
            prefix,
            suffix,
            prompt: "",
            llm,
            options,
            startTime,
            cacheHit: true,
            filepath: input.filepath,
            completionId: input.completionId,
          });
        }
      }

      if (
        !force &&
        options.debounceDelay > 0 &&
        (await this.debouncer.delayAndShouldDebounce(options.debounceDelay))
      ) {
        return undefined;
      }

      const prompt = [
        "You are an inline code completion engine.",
        "Fill the code at <CURSOR> using the prefix and suffix.",
        "Output only the raw code that should be inserted at <CURSOR>.",
        "Do not output markdown fences, explanations, comments about the task, or surrounding code.",
        "If no useful completion is possible, output nothing.",
        "",
        `File: ${input.filepath}`,
        "<PREFIX>",
        prefix,
        "</PREFIX>",
        "<CURSOR>",
        "<SUFFIX>",
        suffix,
        "</SUFFIX>",
      ].join("\n");
      const streamOptions = {
        maxTokens: Math.min(AUTOCOMPLETE_MAX_OUTPUT_TOKENS, 192),
        temperature: 0.01,
        stop: [
          "</PREFIX>",
          "</SUFFIX>",
          "<CURSOR>",
          "```",
          "\nExplanation",
          "\nHere",
          "\nSure",
        ],
      };

      let completion = "";
      for await (const update of llm.streamComplete(prompt, timeoutSignal.signal, streamOptions)) {
        if (token.aborted || timeoutSignal.signal.aborted) {
          return undefined;
        }
        completion += update;
        if (update && handlers?.onPartial) {
          handlers.onPartial(completion);
        }
        if (!this.shouldCompleteMultilineLightweight(input, options)) {
          const firstLine = completion.split("\n")[0] ?? "";
          if (firstLine !== completion) {
            completion = firstLine;
            break;
          }
        }
      }

      if (token.aborted || timeoutSignal.signal.aborted) {
        return undefined;
      }

      const rawCompletion = completion;
      completion = options.transform
        ? (postprocessCompletion({ completion, prefix, suffix, llm }) ?? "")
        : completion;
      if (!completion && rawCompletion.trim()) {
        completion = rawCompletion;
      }
      if (!completion) {
        return undefined;
      }

      const outcome = this.buildOutcome({
        completion,
        prefix,
        suffix,
        prompt,
        llm,
        options,
        startTime,
        cacheHit: false,
        completionOptions: streamOptions,
        filepath: input.filepath,
        completionId: input.completionId,
      });

      if (options.useCache) {
        void cache
          .put(prefixCacheKey, outcome.completion)
          .catch((e) => console.warn(`Failed to save to cache: ${e.message}`));
      }
      return outcome;
    } catch (e) {
      this.onError(e);
      return undefined;
    } finally {
      timeoutSignal.dispose();
    }
  }

  private buildOutcome({
    completion,
    prefix,
    suffix,
    prompt,
    llm,
    options,
    startTime,
    cacheHit,
    completionOptions,
    filepath,
    completionId,
  }: {
    completion: string;
    prefix: string;
    suffix: string;
    prompt: string;
    llm: ILLM;
    options: TabAutocompleteOptions;
    startTime: number;
    cacheHit: boolean;
    completionOptions?: Partial<CompletionOptions>;
    filepath: string;
    completionId: string;
  }): AutocompleteOutcome {
    const outcome: AutocompleteOutcome = {
      time: Date.now() - startTime,
      completion,
      prefix,
      suffix,
      prompt,
      modelProvider: llm.underlyingProviderName,
      modelName: llm.model,
      completionOptions,
      cacheHit,
      filepath,
      numLines: completion.split("\n").length,
      completionId,
      uniqueId: llm.uniqueId,
      timestamp: new Date().toISOString(),
      profileType:
        this.configHandler.currentProfile?.profileDescription.profileType,
      ...options,
    };

    return outcome;
  }

  public async dispose() {
    if (this.autocompleteCache) {
      await this.autocompleteCache.close();
    }
  }
}
