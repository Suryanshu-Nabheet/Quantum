import { ToolPolicy } from "terminal-security";
import { Tool } from "../..";
import { ResolvedPath, resolveInputPath } from "../../util/pathResolver";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";
import { evaluateFileAccessPolicy } from "../policies/fileAccess";

export const viewSubdirectoryTool: Tool = {
  type: "function",
  displayTitle: "View Subdirectory",
  wouldLikeTo: 'list the contents of "{{{ directory_path }}}"',
  isCurrently: 'listing the contents of "{{{ directory_path }}}"',
  hasAlready: 'listed the contents of "{{{ directory_path }}}"',
  readonly: true,
  group: BUILT_IN_GROUP_NAME,
  isInstant: true,
  function: {
    name: BuiltInToolNames.ViewSubdirectory,
    description: "View the contents of a subdirectory",
    parameters: {
      type: "object",
      required: ["directory_path"],
      properties: {
        directory_path: {
          type: "string",
          description:
            "The path of the subdirectory to view, relative to the root of the workspace",
        },
      },
    },
  },
  systemMessageDescription: {
    prefix: `To inspect a specific folder within the project, use the ${BuiltInToolNames.ViewSubdirectory} tool. This returns a concise listing of the folder's direct contents.`,
    exampleArgs: [["directory_path", "path/to/subdirectory"]],
  },
  defaultToolPolicy: "allowedWithoutPermission",
  toolCallIcon: "FolderOpenIcon",
  preprocessArgs: async (args, { ide }) => {
    const directoryPath = args.directory_path as string;
    const resolvedPath = await resolveInputPath(ide, directoryPath);

    return {
      resolvedPath,
    };
  },
  evaluateToolCallPolicy: (
    basePolicy: ToolPolicy,
    _: Record<string, unknown>,
    processedArgs?: Record<string, unknown>,
  ): ToolPolicy => {
    const resolvedPath = processedArgs?.resolvedPath as
      | ResolvedPath
      | null
      | undefined;
    if (!resolvedPath) return basePolicy;

    return evaluateFileAccessPolicy(basePolicy, resolvedPath.isWithinWorkspace);
  },
};
