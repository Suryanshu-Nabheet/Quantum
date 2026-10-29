import { ToolImpl } from ".";
import { ContextItem } from "../..";
import { getStringArg } from "../parseArgs";
import { getShortestUniqueRelativeUriPaths } from "../../util/uri";

const MAX_AGENT_GLOB_RESULTS = 100;

export const fileGlobSearchImpl: ToolImpl = async (args, extras) => {
  const pattern = getStringArg(args, "pattern");
  const [results, workspaceDirs] = await Promise.all([
    extras.ide.getFileResults(pattern, MAX_AGENT_GLOB_RESULTS),
    extras.ide.getWorkspaceDirs(),
  ]);

  if (results.length === 0) {
    return [
      {
        name: "File results",
        description: "glob search",
        content: "The glob search returned no results.",
      },
    ];
  }
  const displayResults = results.every((result) => result.includes("://"))
    ? getShortestUniqueRelativeUriPaths(results, workspaceDirs).map(
        (result) => result.uniquePath,
      )
    : results;
  const contextItems: ContextItem[] = [
    {
      name: "File results",
      description: "glob search",
      content: displayResults.join("\n"),
    },
  ];

  // In case of truncation, add a warning
  if (results.length === MAX_AGENT_GLOB_RESULTS) {
    contextItems.push({
      name: "Truncation warning",
      description: "",
      content: `Warning: the results above were truncated to the first ${MAX_AGENT_GLOB_RESULTS} files. If the results are not satisfactory, refine your search pattern`,
    });
  }

  return contextItems;
};
