import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../../index.js";
import {
  findUriInDirs,
  getShortestUniqueRelativeUriPaths,
  getUriPathBasename,
  joinPathsToUri,
} from "../../util/uri.js";
import {
  isSecurityConcern,
  throwIfFileIsSecurityConcern,
} from "../../indexing/ignore.js";
import { BaseContextProvider } from "../index.js";

const MAX_FOLDER_CONTEXT_ITEMS = 300;
const MAX_FOLDER_SUBMENU_ITEMS = 500;
const MAX_FOLDER_SOURCE_FILES = 2000;

export function getWorkspaceFolderUris(
  fileResults: string[],
  workspaceDirs: string[],
  maxItems = MAX_FOLDER_SUBMENU_ITEMS,
): string[] {
  const seen = new Set<string>();
  const folderUris: string[] = [];
  for (const root of workspaceDirs) {
    if (!seen.has(root) && folderUris.length < maxItems) {
      seen.add(root);
      folderUris.push(root);
    }
  }

  for (const result of fileResults) {
    const fileUri = result.includes("://")
      ? result
      : workspaceDirs[0]
        ? joinPathsToUri(workspaceDirs[0], result)
        : undefined;
    if (!fileUri) {
      continue;
    }

    const { foundInDir, relativePathOrBasename } = findUriInDirs(
      fileUri,
      workspaceDirs,
    );
    if (!foundInDir) {
      continue;
    }

    const pathParts = relativePathOrBasename.split("/").filter(Boolean);
    let relativeFolder = "";
    for (const part of pathParts.slice(0, -1)) {
      relativeFolder = relativeFolder ? `${relativeFolder}/${part}` : part;
      const folderUri = joinPathsToUri(foundInDir, relativeFolder);
      if (seen.has(folderUri)) {
        continue;
      }
      seen.add(folderUri);
      folderUris.push(folderUri);
      if (folderUris.length >= maxItems) {
        return folderUris;
      }
    }
  }

  return folderUris;
}

class FolderContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "folder",
    displayTitle: "Folder",
    description: "Type to search",
    type: "submenu",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const folderUri = query.trim();
    throwIfFileIsSecurityConcern(
      folderUri.endsWith("/") ? folderUri : `${folderUri}/`,
    );
    let entries: string[] = [];
    try {
      const children = await extras.ide.listDir(folderUri);
      entries = children
        .filter(([name, type]) => {
          const childUri = joinPathsToUri(folderUri, name);
          return !isSecurityConcern(
            (type & 2) !== 0 ? `${childUri}/` : childUri,
          );
        })
        .slice(0, MAX_FOLDER_CONTEXT_ITEMS)
        .map(([name, type]) => `${name}${(type & 2) !== 0 ? "/" : ""}`);
    } catch {
      return [];
    }
    return [
      {
        name: getUriPathBasename(folderUri),
        description: folderUri,
        content: `Files and folders in ${folderUri}:\n\n${entries.join("\n")}`,
        uri: {
          type: "file",
          value: folderUri,
        },
      },
    ];
  }
  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    const [workspaceDirs, files] = await Promise.all([
      args.ide.getWorkspaceDirs(),
      args.ide.getFileResults("**/*", MAX_FOLDER_SOURCE_FILES, {
        includeMedia: true,
      }),
    ]);
    if (!workspaceDirs.length) {
      return [];
    }

    const folderUris = getWorkspaceFolderUris(
      files.filter((file) => !isSecurityConcern(file)),
      workspaceDirs,
      MAX_FOLDER_SUBMENU_ITEMS,
    ).filter((folder) =>
      !isSecurityConcern(folder.endsWith("/") ? folder : `${folder}/`),
    );

    const withUniquePaths = getShortestUniqueRelativeUriPaths(
      folderUris,
      workspaceDirs,
    );

    return withUniquePaths.map((folder) => {
      const title = getUriPathBasename(folder.uri);
      return {
        id: folder.uri,
        title: title || folder.uniquePath || folder.uri,
        description: folder.uniquePath || folder.uri,
      };
    });
  }
}

export default FolderContextProvider;
