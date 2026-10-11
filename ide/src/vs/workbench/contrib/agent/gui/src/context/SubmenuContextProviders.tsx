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
  useEffect,
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
const PREFETCH_TITLES = new Set(["file", "folder", "commit", "branch"]);

function matchesQuery(
  item: { title: string; description: string },
  query: string,
): boolean {
  const needle = query.toLowerCase();
  return (
    item.title.toLowerCase().includes(needle) ||
    item.description.toLowerCase().includes(needle)
  );
}

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
  const inflightLoads = useRef(
    new Map<ContextProviderName, Promise<void>>(),
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

        if (providerTitle && query.trim() && !minisearches[providerTitle]) {
          return (fallbackResults[providerTitle] ?? [])
            .filter((item) => matchesQuery(item, query))
            .slice(0, limit)
            .map((result) => ({ ...result, providerTitle }));
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
          const source = providerTitle
            ? (fallbackResults[providerTitle] ?? [])
            : [];
          const filtered = query.trim()
            ? source.filter((item) => matchesQuery(item, query))
            : source;
          const fallbackItems = filtered.slice(0, limit).map((result) => {
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
            const refreshProvider =
              providers === "all" || providers.includes(description.title);
            if (!refreshProvider) {
              return;
            }

            const title = description.title;
            const running = inflightLoads.get(title);
            if (running) {
              await running;
              return;
            }

            const job = (async () => {
              providersLoading.add(title);
              const loadVersion = (providerLoadVersions.get(title) ?? 0) + 1;
              providerLoadVersions.set(title, loadVersion);
              try {
                const result: any = await ideMessenger.request(
                  "context/loadSubmenuItems",
                  { title },
                );
                if (providerLoadVersions.get(title) !== loadVersion) {
                  return;
                }
                if (result.status === "error") {
                  throw new Error(result.error);
                }
                const submenuItems: any[] = result.content ?? [];
                const itemsWithProvider = submenuItems.map((item: any) => ({
                  ...item,
                  providerTitle: title,
                  renderInlineAs: description.renderInlineAs,
                }));
                fallbackResults[title] = itemsWithProvider;
                setCacheVersion((version) => version + 1);

                const indexItems = () => {
                  if (providerLoadVersions.get(title) !== loadVersion) {
                    return;
                  }
                  const minisearch =
                    new MiniSearch<ContextSubmenuItemWithProvider>({
                      fields: ["title", "description"],
                      storeFields: ["id", "title", "description", "providerTitle"],
                      tokenize: (text) =>
                        deduplicateArray(
                          MiniSearch.getDefault("tokenize")(text).concat(
                            splitCamelCaseAndNonAlphaNumeric(text),
                          ),
                          (a: string, b: string) => a === b,
                        ),
                    });
                  const seenIds = new Set<string>();
                  const uniqueItems = [];
                  for (const item of itemsWithProvider) {
                    if (seenIds.has(item.id)) {
                      continue;
                    }
                    seenIds.add(item.id);
                    uniqueItems.push(item);
                  }
                  minisearch.addAll(uniqueItems);
                  minisearches[title] = minisearch;
                  setCacheVersion((version) => version + 1);
                };
                if (typeof requestIdleCallback === "function") {
                  requestIdleCallback(indexItems, { timeout: 400 });
                } else {
                  setTimeout(indexItems, 0);
                }
              } catch (error) {
                console.error(`Error loading items for ${title}:`, error);
              } finally {
                providersLoading.delete(title);
              }
            })();

            inflightLoads.set(title, job);
            try {
              await job;
            } finally {
              inflightLoads.delete(title);
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
      inflightLoads,
      providerLoadVersions,
    ],
  );

  useEffect(() => {
    const titles = submenuContextProviders
      .map((provider) => provider.title)
      .filter((title) => PREFETCH_TITLES.has(title));
    if (titles.length === 0) {
      return;
    }
    void loadSubmenuItems(titles);
  }, [submenuContextProviders, loadSubmenuItems]);

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
