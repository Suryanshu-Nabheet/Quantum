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

  let results: Awaited<ReturnType<typeof extras.ide.getSearchResults>>;
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
          content: `The search failed due to an invalid regex pattern.\n\nOriginal query: ${rawQuery}\nProcessed query: ${query}\n\nError: ${errorMessage}\n\nTip: Grep Search interprets the query as a regular expression. Escape regex metacharacters when searching for them literally.`,
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
    numExcludedFiles,
    truncated,
  } = formatGrepSearchResults(results.content, DEFAULT_GREP_SEARCH_CHAR_LIMIT);

  if (numResults === 0) {
    const contextItems: ContextItem[] = [
      {
        name: "Search results",
        description: "Results from grep search",
        content:
          numExcludedFiles > 0
            ? `All ${numExcludedFiles} matching files were excluded because they are protected. No file contents were provided to the Agent.`
            : "The search returned no matches.",
      },
    ];
    if (results.limitHit) {
      contextItems.push({
        name: "Truncation warning",
        description: "",
        content: `The workbench search reached its ${DEFAULT_GREP_SEARCH_RESULTS_LIMIT}-file limit. Additional matching files may have been omitted; refine the query to search a narrower set.`,
      });
    }
    if (warning) {
      contextItems.push({
        name: "Search note",
        description: "",
        content: warning,
      });
    }
    return contextItems;
  }

  const truncationReasons: string[] = [];
  if (results.limitHit) {
    truncationReasons.push(
      `the workbench search reached its ${DEFAULT_GREP_SEARCH_RESULTS_LIMIT}-file limit, so additional matching files may have been omitted`,
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

  if (numExcludedFiles > 0) {
    contextItems.push({
      name: "Protected files excluded",
      description: "",
      content: `${numExcludedFiles} matching file${numExcludedFiles === 1 ? " was" : "s were"} excluded because they are protected.`,
    });
  }

  if (warning) {
    contextItems.push({
      name: "Search note",
      description: "",
      content: warning,
    });
  }

  if (truncationReasons.length > 0) {
    contextItems.push({
      name: "Truncation warning",
      description: "",
      content: `The above search results were truncated because ${truncationReasons.join(" and ")}. Refine the search query to inspect a narrower result set.`,
    });
  }
  return contextItems;
};
