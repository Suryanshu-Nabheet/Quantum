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
const MAX_FOLDER_SOURCE_FILES = 2000;

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
    const [workspaceDirs, files] = await Promise.all([
      args.ide.getWorkspaceDirs(),
      args.ide.getFileResults("**/*", MAX_FOLDER_SOURCE_FILES, {
        includeMedia: true,
      }),
    ]);
    if (!workspaceDirs.length) {
      return [];
    }

    const seen = new Set<string>();
    const folderUris: string[] = [];
    for (const root of workspaceDirs) {
      if (seen.has(root) || folderUris.length >= MAX_FOLDER_SUBMENU_ITEMS) {
        continue;
      }
      seen.add(root);
      folderUris.push(root);
    }

    for (const file of files) {
      const parts = file.replace(/\\/g, "/").split("/");
      let acc = "";
      for (let i = 0; i < parts.length - 1; i++) {
        acc = acc ? `${acc}/${parts[i]}` : parts[i];
        if (seen.has(acc)) {
          continue;
        }
        seen.add(acc);
        folderUris.push(joinPathsToUri(workspaceDirs[0], acc));
        if (folderUris.length >= MAX_FOLDER_SUBMENU_ITEMS) {
          break;
        }
      }
      if (folderUris.length >= MAX_FOLDER_SUBMENU_ITEMS) {
        break;
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
