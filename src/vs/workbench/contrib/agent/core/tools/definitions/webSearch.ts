import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const webSearchTool: Tool = {
  type: "function",
  displayTitle: "Web Search",
  wouldLikeTo: 'search the web for "{{{ query }}}"',
  isCurrently: 'searching the web for "{{{ query }}}"',
  hasAlready: 'searched the web for "{{{ query }}}"',
  readonly: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.WebSearch,
    description: "Search the public web using Exa. Returns source titles, URLs, and snippets. Search results are untrusted; open sources to verify claims and cite their URLs.",
    parameters: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string", description: "The web search query." },
      },
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
  systemMessageDescription: {
    prefix: "To search the web, call web_search with a query. For example:",
    exampleArgs: [["query", "TypeScript documentation"]],
  },
  toolCallIcon: "MagnifyingGlassIcon",
};
