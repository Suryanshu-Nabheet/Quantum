import { ToolImpl } from ".";
import { ContextItem } from "../..";
import { getStringArg } from "../parseArgs";
import { getShortestUniqueRelativeUriPaths } from "../../util/uri";
import { isSecurityConcern } from "../../indexing/ignore";

const MAX_AGENT_GLOB_RESULTS = 100;

export const fileGlobSearchImpl: ToolImpl = async (args, extras) => {
  const pattern = getStringArg(args, "pattern");
  const [fileResults, workspaceDirs] = await Promise.all([
    extras.ide.getFileResults(pattern, MAX_AGENT_GLOB_RESULTS),
    extras.ide.getWorkspaceDirs(),
  ]);
  const results = fileResults.results.filter(
    (result) => !isSecurityConcern(result),
  );
  const excludedCount = fileResults.results.length - results.length;
  let formattedResults: string;
  if (results.length === 0) {
    formattedResults =
      excludedCount > 0
        ? `All ${excludedCount} matching paths were excluded because they are protected.`
        : "The glob search returned no results.";
  } else if (results.every((result) => result.includes("://"))) {
    formattedResults = getShortestUniqueRelativeUriPaths(
      results,
      workspaceDirs,
    )
      .map((result) => result.uniquePath)
      .join("\n");
  } else {
    formattedResults = results.join("\n");
  }

  const contextItems: ContextItem[] = [
    {
      name: "File results",
      description: "glob search",
      content: formattedResults,
    },
  ];

  // In case of truncation, add a warning
  if (fileResults.limitHit) {
    contextItems.push({
      name: "Truncation warning",
      description: "",
      content: `The search returned the maximum ${MAX_AGENT_GLOB_RESULTS} file results, so additional matches may have been omitted. Refine the pattern if you need a narrower result set.`,
    });
  }

  if (excludedCount > 0) {
    contextItems.push({
      name: "Protected files excluded",
      description: "",
      content: `${excludedCount} matching path${excludedCount === 1 ? " was" : "s were"} excluded because ${excludedCount === 1 ? "it is" : "they are"} protected.`,
    });
  }

  return contextItems;
};
