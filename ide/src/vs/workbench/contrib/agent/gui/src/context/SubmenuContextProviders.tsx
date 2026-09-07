import {
  ContextProviderDescription,
  ContextProviderName,
  ContextSubmenuItemWithProvider,
} from "core";
import { deduplicateArray, splitCamelCaseAndNonAlphaNumeric } from "core/util";
import MiniSearch, { SearchResult } from "minisearch";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { useWebviewListener } from "../hooks/useWebviewListener";
import { useAppSelector } from "../redux/hooks";
import { selectSubmenuContextProviders } from "../redux/selectors";
import { IdeMessengerContext } from "./IdeMessenger";

const MINISEARCH_OPTIONS = {
  prefix: true,
  fuzzy: 2,
};

const MAX_LENGTH = 70;

type SubmenuProviderRefreshTarget = "all" | ContextProviderName[];

interface SubtextContextProvidersContextType {
  getSubmenuContextItems: (
    providerTitle: string | undefined,
    query: string,
  ) => ContextSubmenuItemWithProvider[];
  refreshSubmenuProviders: (
    providers: SubmenuProviderRefreshTarget,
  ) => Promise<void>;
}

const initialContextProviders: SubtextContextProvidersContextType = {
  getSubmenuContextItems: () => [],
  refreshSubmenuProviders: async () => {},
};

const SubmenuContextProvidersContext =
  createContext<SubtextContextProvidersContextType>(initialContextProviders);

export const SubmenuContextProvidersProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const ideMessenger = useContext(IdeMessengerContext);
  const submenuContextProviders = useAppSelector(selectSubmenuContextProviders);

  const [, setCacheVersion] = useState(0);
  const minisearches = useRef<{
    [id: string]: MiniSearch<ContextSubmenuItemWithProvider>;
  }>({}).current;
  const fallbackResults = useRef<{
    [id: string]: ContextSubmenuItemWithProvider[];
  }>({}).current;
  const providersLoading = useRef(new Set<ContextProviderName>()).current;
  const abortControllers = useRef(
    new Map<ContextProviderName, AbortController>(),
  ).current;
  const providerLoadVersions = useRef(
    new Map<ContextProviderName, number>(),
  ).current;

  const getSubmenuContextItems = useCallback(
    (
      providerTitle: string | undefined,
      query: string,
      limit: number = MAX_LENGTH,
    ): ContextSubmenuItemWithProvider[] => {
      try {
        if (providerTitle && !query.trim()) {
          const fallbackItems = (fallbackResults[providerTitle] ?? [])
            .slice(0, limit)
            .map((result) => ({
              ...result,
              providerTitle,
            }));
          if (fallbackItems.length > 0) {
            return fallbackItems;
          }
        }

        // 1. Search using minisearch
        let searchResults: (SearchResult & ContextSubmenuItemWithProvider)[] =
          [];

        if (providerTitle === undefined) {
          // Include results from all providers
          searchResults = Object.keys(minisearches).flatMap((providerTitle) =>
            minisearches[providerTitle]
              .search(query, MINISEARCH_OPTIONS)
              .map((result) => {
                return {
                  ...result,
                  providerTitle,
                  title: result.title,
                  description: result.description,
                };
              }),
          );
        } else {
          // Only include results from the specified provider
          if (minisearches[providerTitle]) {
            searchResults = minisearches[providerTitle]
              .search(query, MINISEARCH_OPTIONS)
              .map((result) => {
                return {
                  ...result,
                  providerTitle,
                  title: result.title,
                  description: result.description,
                };
              });
          }
        }

        searchResults.sort((a, b) => b.score - a.score);

        // 3. Add fallback results if no search results
        if (searchResults.length === 0) {
          const fallbackItems = (
            providerTitle ? (fallbackResults[providerTitle] ?? []) : []
          )
            .slice(0, limit)
            .map((result) => {
              return {
                ...result,
                providerTitle: providerTitle || "unknown",
              };
            });

          if (fallbackItems.length === 0 && providerTitle) {
            if (providersLoading.has(providerTitle)) {
              return [
                {
                  id: "loading",
                  title: "Loading...",
                  description: "Loading items",
                  providerTitle,
                },
              ];
            }
          }

          return fallbackItems;
        }
        const limitedResults = searchResults.slice(0, limit).map((result) => {
          return {
            id: result.id,
            title: result.title,
            description: result.description,
            providerTitle: result.providerTitle,
          };
        });
        return limitedResults;
      } catch (error) {
        console.error("Error in getSubmenuContextItems:", error);
        return [];
      }
    },
    [fallbackResults, minisearches, providersLoading],
  );

  const loadSubmenuItems = useCallback(
    async (providers: SubmenuProviderRefreshTarget) => {
      await Promise.allSettled(
        submenuContextProviders.map(
          async (description: ContextProviderDescription) => {
            const controller = new AbortController();
            try {
              const refreshProvider =
                providers === "all" || providers.includes(description.title);

              if (!refreshProvider) {
                return;
              }

              // Submenu loading requests cancel existing requests
              abortControllers.get(description.title)?.abort();
              abortControllers.set(description.title, controller);
              providersLoading.add(description.title);
              const loadVersion =
                (providerLoadVersions.get(description.title) ?? 0) + 1;
              providerLoadVersions.set(description.title, loadVersion);

              const result: any = await ideMessenger.request(
                "context/loadSubmenuItems",
                {
                  title: description.title,
                },
              );

              if (
                controller.signal.aborted ||
                providerLoadVersions.get(description.title) !== loadVersion
              ) {
                return;
              }

              if (result.status === "error") {
                throw new Error(result.error);
              }
              const submenuItems: any[] = result.content ?? [];
              const providerTitle = description.title;
              const renderInlineAs = description.renderInlineAs;

              const itemsWithProvider = submenuItems.map((item: any) => ({
                ...item,
                providerTitle,
                renderInlineAs,
              }));

              const minisearch = new MiniSearch<ContextSubmenuItemWithProvider>(
                {
                  fields: ["title", "description"],
                  storeFields: ["id", "title", "description", "providerTitle"],
                  tokenize: (text) =>
                    deduplicateArray(
                      MiniSearch.getDefault("tokenize")(text).concat(
                        splitCamelCaseAndNonAlphaNumeric(text),
                      ),
                      (a: string, b: string) => a === b,
                    ),
                },
              );

              const deduplicatedItems: any[] = deduplicateArray(
                submenuItems.map((item: any) => ({ ...item, providerTitle })),
                (a: any, b: any) => a.id === b.id,
              );
              minisearch.addAll(deduplicatedItems);

              minisearches[providerTitle] = minisearch;
              fallbackResults[providerTitle] = itemsWithProvider;
              setCacheVersion((version) => version + 1);
            } catch (error) {
              console.error(
                `Error loading items for ${description.title}:`,
                error,
              );
              console.error(
                "Error details:",
                JSON.stringify(error, Object.getOwnPropertyNames(error)),
              );
            } finally {
              if (!controller.signal.aborted) {
                providersLoading.delete(description.title);
                setCacheVersion((version) => version + 1);
              }
            }
          },
        ),
      );
    },
    [
      submenuContextProviders,
      ideMessenger,
      fallbackResults,
      minisearches,
      providersLoading,
      abortControllers,
      providerLoadVersions,
    ],
  );

  useWebviewListener(
    "refreshSubmenuItems",
    async (data) => {
      void loadSubmenuItems(data.providers);
    },
    [loadSubmenuItems],
  );

  return (
    <SubmenuContextProvidersContext.Provider
      value={{
        getSubmenuContextItems,
        refreshSubmenuProviders: loadSubmenuItems,
      }}
    >
      {children}
    </SubmenuContextProvidersContext.Provider>
  );
};

export const useSubmenuContextProviders = () =>
  useContext(SubmenuContextProvidersContext);
