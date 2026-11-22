import { IDE } from "../..";
import { throwIfFileIsSecurityConcern } from "../../indexing/ignore";
import { AgentError, AgentErrorReason } from "../../util/errors";
import { resolveRelativePathInDir } from "../../util/ideUtils";

export async function validateSearchAndReplaceFilepath(
  filepath: unknown,
  ide: IDE,
) {
  if (!filepath || typeof filepath !== "string") {
    throw new AgentError(
      AgentErrorReason.FindAndReplaceMissingFilepath,
      "filepath (string) is required",
    );
  }
  const resolvedFilepath = await resolveRelativePathInDir(filepath, ide);
  if (!resolvedFilepath) {
    throw new AgentError(
      AgentErrorReason.FileNotFound,
      `File ${filepath} does not exist`,
    );
  }
  return resolveSafeEditUri(resolvedFilepath, ide);
}

/** Validate both the requested path and the path the filesystem will open. */
export async function resolveSafeEditUri(uri: string, ide: IDE): Promise<string> {
  throwIfFileIsSecurityConcern(uri);
  const target = (await ide.resolveRealPath?.(uri)) ?? uri;
  throwIfFileIsSecurityConcern(target);
  return target;
}
