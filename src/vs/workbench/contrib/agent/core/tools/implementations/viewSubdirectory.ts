import { resolveInputPath } from "../../util/pathResolver";

import { ToolImpl } from ".";
import { AgentError, AgentErrorReason } from "../../util/errors";
import { getStringArg } from "../parseArgs";

const MAX_SUBDIRECTORY_ITEMS = 300;

export const viewSubdirectoryImpl: ToolImpl = async (args: any, extras) => {
  const directory_path = getStringArg(args, "directory_path");

  const resolvedPath = await resolveInputPath(extras.ide, directory_path);

  if (!resolvedPath) {
    throw new AgentError(
      AgentErrorReason.DirectoryNotFound,
      `Directory path "${directory_path}" does not exist or is not accessible.`,
    );
  }

  // Check if the resolved path actually exists
  const exists = await extras.ide.fileExists(resolvedPath.uri);
  if (!exists) {
    throw new AgentError(
      AgentErrorReason.DirectoryNotFound,
      `Directory path "${directory_path}" does not exist or is not accessible.`,
    );
  }

  const entries = (await extras.ide.listDir(resolvedPath.uri))
    .slice(0, MAX_SUBDIRECTORY_ITEMS)
    .map(([name, type]) => `${name}${(type & 2) !== 0 ? "/" : ""}`);

  return [
    {
      name: "Subdirectory",
      description: `Contents of ${resolvedPath.displayPath}`,
      content: entries.join("\n"),
    },
  ];
};
