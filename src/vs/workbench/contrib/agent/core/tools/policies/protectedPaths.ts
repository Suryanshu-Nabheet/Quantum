import { ToolPolicy } from "terminal-security";
import { pathMatchesPatternList } from "../../util/pathPatternMatch";
import { BuiltInToolNames } from "../builtIn";

/** Default globs that always require approval before the agent touches them. */
export const DEFAULT_PROTECTED_FILE_PATTERNS: string[] = [
  ".env",
  ".env.*",
  "**/*.pem",
  "**/*.key",
  "**/secrets/**",
  "**/*credentials*",
];

const FILE_WRITE_TOOLS = new Set<string>([
  BuiltInToolNames.CreateNewFile,
  BuiltInToolNames.EditExistingFile,
  BuiltInToolNames.SingleFindAndReplace,
  BuiltInToolNames.MultiEdit,
]);

const FILE_READ_TOOLS = new Set<string>([
  BuiltInToolNames.ReadFile,
  BuiltInToolNames.ReadFileRange,
  BuiltInToolNames.ReadCurrentlyOpenFile,
]);

export function extractToolTargetPath(
  parsedArgs: Record<string, unknown>,
  processedArgs?: Record<string, unknown>,
): string | undefined {
  const resolved = processedArgs?.resolvedPath as
    | { displayPath?: string }
    | undefined;
  if (resolved?.displayPath) {
    return resolved.displayPath;
  }
  if (typeof processedArgs?.fileUri === "string") {
    return processedArgs.fileUri;
  }
  const candidate =
    parsedArgs.filepath ??
    parsedArgs.path ??
    parsedArgs.directory ??
    parsedArgs.directoryPath;
  if (typeof candidate === "string" && candidate.trim()) {
    return candidate.trim();
  }
  return undefined;
}

/**
 * Force approval for sensitive paths even when Agent Access is Full.
 * Applied after access-mode elevation so Full cannot bypass protected paths.
 */
export function applyProtectedPathPolicy(
  toolName: string,
  policy: ToolPolicy,
  targetPath: string,
  patterns: string[],
  options: { requireReadApproval: boolean },
): ToolPolicy {
  if (policy === "disabled" || !patterns.length) {
    return policy;
  }
  if (!pathMatchesPatternList(targetPath, patterns)) {
    return policy;
  }

  if (FILE_WRITE_TOOLS.has(toolName)) {
    return "allowedWithPermission";
  }

  if (
    options.requireReadApproval &&
    FILE_READ_TOOLS.has(toolName) &&
    policy === "allowedWithoutPermission"
  ) {
    return "allowedWithPermission";
  }

  return policy;
}
