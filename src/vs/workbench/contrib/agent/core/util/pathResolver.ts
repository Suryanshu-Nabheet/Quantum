import { fileURLToPath, pathToFileURL } from "node:url";
import * as path from "path";
import untildify from "untildify";
import { IDE } from "..";
import { resolveRelativePathInDir } from "./ideUtils";
import { findUriInDirs } from "./uri";
import { throwIfFileIsSecurityConcern } from "../indexing/ignore";

export interface ResolvedPath {
  uri: string;
  displayPath: string;
  isAbsolute: boolean;
  isWithinWorkspace: boolean;
}

async function resolvePath(
  ide: IDE,
  uri: string,
  displayPath: string,
  isAbsolute: boolean,
): Promise<ResolvedPath> {
  throwIfFileIsSecurityConcern(uri);
  const realUri = await ide.resolveRealPath?.(uri);
  if (realUri) {
    throwIfFileIsSecurityConcern(realUri);
  }
  let withinWorkspace = !isAbsolute;
  if (realUri || isAbsolute) {
    const workspaceDirs = await ide.getWorkspaceDirs();
    const workspaceRoots = realUri
      ? await Promise.all(workspaceDirs.map(async (dir) => (await ide.resolveRealPath?.(dir)) ?? dir))
      : workspaceDirs;
    withinWorkspace = findUriInDirs(realUri ?? uri, workspaceRoots).foundInDir !== null;
  }
  return {
    uri: realUri ?? uri,
    displayPath: realUri && realUri !== uri ? realUri : displayPath,
    isAbsolute,
    isWithinWorkspace: withinWorkspace && (isAbsolute ? await ide.fileExists(uri) : true),
  };
}

export async function resolveInputPath(
  ide: IDE,
  inputPath: string,
): Promise<ResolvedPath | null> {
  const trimmedPath = inputPath.trim();

  // Handle file:// URIs
  if (trimmedPath.startsWith("file://")) {
    const displayPath = fileURLToPath(trimmedPath);
    return await resolvePath(ide, trimmedPath, displayPath, true);
  }

  // Expand tilde paths (handles ~/ and ~username/)
  const expandedPath = untildify(trimmedPath);

  // Check if it's an absolute path (including Windows paths)
  const isAbsolute =
    path.isAbsolute(expandedPath) ||
    // Windows network paths
    expandedPath.startsWith("\\\\") ||
    // Windows drive letters
    /^[a-zA-Z]:/.test(expandedPath);

  if (isAbsolute) {
    // Convert to file:// URI format
    const uri = pathToFileURL(expandedPath).href;
    return await resolvePath(ide, uri, expandedPath, true);
  }

  // Handle relative paths...
  const workspaceUri = await resolveRelativePathInDir(expandedPath, ide);
  if (workspaceUri) {
    return await resolvePath(ide, workspaceUri, expandedPath, false);
  }

  return null;
}
