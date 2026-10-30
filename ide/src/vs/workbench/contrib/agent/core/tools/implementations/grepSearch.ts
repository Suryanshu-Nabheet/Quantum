import { ToolImpl } from ".";
import { ContextItem } from "../..";
import { AgentError, AgentErrorReason } from "../../util/errors";
import {
  formatGrepSearchResults,
  isGrepSearchFileHeader,
} from "../../util/grepSearch";
import { prepareQueryForRipgrep } from "../../util/regexValidator";
import { getStringArg } from "../parseArgs";

const DEFAULT_GREP_SEARCH_RESULTS_LIMIT = 100;
const DEFAULT_GREP_SEARCH_CHAR_LIMIT = 7500; // ~1500 tokens, will keep truncation simply for now

function splitGrepResultsByFile(content: string): ContextItem[] {
  const contextItems: ContextItem[] = [];
  let filepath: string | undefined;
  let fileLines: string[] = [];

  const flushFile = () => {
    const fileContent = fileLines.join("\n").trim();
    if (filepath && fileContent) {
      contextItems.push({
        name: `Search results in ${filepath}`,
        description: `Grep search results from ${filepath}`,
        content: fileContent,
        uri: { type: "file", value: filepath },
      });
    }
  };

  for (const line of content.split("\n")) {
    if (isGrepSearchFileHeader(line)) {
      flushFile();
      filepath = line;
      fileLines = [];
    } else if (line !== "--" && filepath) {
      fileLines.push(line);
    }
  }
  flushFile();

  return contextItems;
}

export const grepSearchImpl: ToolImpl = async (args, extras) => {
  const rawQuery = getStringArg(args, "query");

  const { query, warning } = prepareQueryForRipgrep(rawQuery);

  let results: string;
  try {
    results = await extras.ide.getSearchResults(
      query,
      DEFAULT_GREP_SEARCH_RESULTS_LIMIT,
      true,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Helpful error for common ripgrep exit code
    if (errorMessage.includes("Process exited with code 2")) {
      return [
        {
          name: "Search error",
          description: "The search query could not be processed",
          content: `The search failed due to an invalid regex pattern.\n\nOriginal query: ${rawQuery}\nProcessed query: ${query}\n\nError: ${errorMessage}\n\nTip: If you're searching for literal text with special characters, the query was automatically escaped. If you need regex patterns, ensure they use proper regex syntax.`,
        },
      ];
    }

    throw new AgentError(
      AgentErrorReason.SearchExecutionFailed,
      errorMessage,
    );
  }

  const {
    formatted,
    numResults,
    numFiles,
    truncated,
  } = formatGrepSearchResults(results, DEFAULT_GREP_SEARCH_CHAR_LIMIT);

  if (numResults === 0) {
    const contextItems: ContextItem[] = [
      {
        name: "Search results",
        description: "Results from grep search",
        content:
          "The search returned no accessible results. Protected files are excluded from Agent search context.",
      },
    ];
    if (numFiles === DEFAULT_GREP_SEARCH_RESULTS_LIMIT) {
      contextItems.push({
        name: "Truncation warning",
        description: "",
        content: `The search returned the maximum ${DEFAULT_GREP_SEARCH_RESULTS_LIMIT} file results before protected files were filtered. Additional matching files may have been omitted; refine the query to find more accessible matches.`,
      });
    }
    return contextItems;
  }

  const truncationReasons: string[] = [];
  if (numFiles === DEFAULT_GREP_SEARCH_RESULTS_LIMIT) {
    truncationReasons.push(
      `the search returned the maximum ${DEFAULT_GREP_SEARCH_RESULTS_LIMIT} file results, so additional matching files may have been omitted`,
    );
  }
  if (truncated) {
    truncationReasons.push(
      `the number of characters exceeded ${DEFAULT_GREP_SEARCH_CHAR_LIMIT}`,
    );
  }

  let contextItems: ContextItem[];

  const splitByFile: boolean = args?.splitByFile || false;
  if (splitByFile) {
    contextItems = splitGrepResultsByFile(formatted);
  } else {
    contextItems = [
      {
        name: "Search results",
        description: "Results from grep search",
        content: formatted,
      },
    ];
  }

  // Add warnings about query modifications or truncation
  const warnings: string[] = [];
  if (warning) {
    warnings.push(warning);
  }
  if (truncationReasons.length > 0) {
    warnings.push(
      `Results were truncated because ${truncationReasons.join(" and ")}`,
    );
  }

  if (truncationReasons.length > 0) {
    contextItems.push({
      name: "Truncation warning",
      description: "",
      content: `The above search results were truncated because ${truncationReasons.join(" and ")}. If the results are not satisfactory, try refining your search query.`,
    });
  }
  return contextItems;
};
