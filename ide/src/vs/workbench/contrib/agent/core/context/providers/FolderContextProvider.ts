import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../../index.js";
import {
  getShortestUniqueRelativeUriPaths,
  getUriPathBasename,
  joinPathsToUri,
} from "../../util/uri.js";
import { BaseContextProvider } from "../index.js";

const MAX_FOLDER_CONTEXT_ITEMS = 300;
const MAX_FOLDER_SUBMENU_ITEMS = 500;
const MAX_FOLDER_SCAN_DIRS = 750;

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
    let entries: string[] = [];
    try {
      entries = (await extras.ide.listDir(folderUri))
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
    const workspaceDirs = await args.ide.getWorkspaceDirs();
    const seen = new Set<string>();
    const queue = [...workspaceDirs];
    const folderUris: string[] = [];

    while (
      queue.length > 0 &&
      folderUris.length < MAX_FOLDER_SUBMENU_ITEMS &&
      seen.size < MAX_FOLDER_SCAN_DIRS
    ) {
      const folderUri = queue.shift();
      if (!folderUri || seen.has(folderUri)) {
        continue;
      }

      seen.add(folderUri);
      folderUris.push(folderUri);

      let entries: [string, number][] = [];
      try {
        entries = await args.ide.listDir(folderUri);
      } catch {
        continue;
      }

      for (const [name, type] of entries) {
        if (
          (type & 2) === 0 ||
          queue.length + seen.size >= MAX_FOLDER_SCAN_DIRS
        ) {
          continue;
        }
        queue.push(joinPathsToUri(folderUri, name));
      }
    }

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
