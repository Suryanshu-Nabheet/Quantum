import { BaseContextProvider } from "../";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../../";
import {
  INLINE_IMAGE_MIME_BY_EXT,
  MEDIA_ATTACH_FIND_GLOB,
  PATH_ONLY_ATTACH_EXTS,
} from "../../indexing/ignore.js";
import {
  getShortestUniqueRelativeUriPaths,
  getUriDescription,
  getUriPathBasename,
  joinPathsToUri,
} from "../../util/uri.js";

const MAX_GENERAL_SUBMENU_ITEMS = 800;
const MAX_MEDIA_SUBMENU_ITEMS = 400;
const MAX_SUBMENU_ITEMS = 1200;
const MAX_FILE_CONTEXT_LINES = 800;
const MAX_INLINE_IMAGE_BYTES = 5 * 1024 * 1024;

function fileExtension(uriOrPath: string): string {
  const base = getUriPathBasename(uriOrPath);
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : "";
}

function resolveWorkspaceFileUris(
  fileResults: string[],
  workspaceDirs: string[],
): string[] {
  if (workspaceDirs.length === 0) {
    return [];
  }

  return fileResults.map((result) => {
    if (result.includes("://")) {
      return result;
    }

    return joinPathsToUri(workspaceDirs[0], result);
  });
}

function toSubmenuItems(
  fileUris: string[],
  workspaceDirs: string[],
): ContextSubmenuItem[] {
  return getShortestUniqueRelativeUriPaths(fileUris, workspaceDirs).map(
    (file) => ({
      id: file.uri,
      title: getUriPathBasename(file.uri),
      description: file.uniquePath,
    }),
  );
}

class FileContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "file",
    displayTitle: "Files",
    description: "Type to search",
    type: "submenu",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const fileUri = query.trim();
    const { relativePathOrBasename, last2Parts, baseName } = getUriDescription(
      fileUri,
      await extras.ide.getWorkspaceDirs(),
    );
    const ext = fileExtension(fileUri);
    const imageMime = INLINE_IMAGE_MIME_BY_EXT[ext];

    // Vision-safe images: inline as data URLs (constructMessages → imageUrl).
    if (imageMime && extras.ide.readFileAsDataUrl) {
      const dataUrl = await extras.ide.readFileAsDataUrl(
        fileUri,
        MAX_INLINE_IMAGE_BYTES,
      );
      if (dataUrl) {
        return [
          {
            name: baseName,
            description: last2Parts,
            content: dataUrl,
            uri: {
              type: "file",
              value: fileUri,
            },
          },
        ];
      }
      return [
        {
          name: baseName,
          description: last2Parts,
          content: `Image file \`${relativePathOrBasename}\` could not be inlined (too large or unreadable). Path: ${fileUri}`,
          uri: {
            type: "file",
            value: fileUri,
          },
        },
      ];
    }

    // Other binaries: path reference only — never mojibake as text.
    if (PATH_ONLY_ATTACH_EXTS.has(ext)) {
      return [
        {
          name: baseName,
          description: last2Parts,
          content: `Attached file \`${relativePathOrBasename}\` (${ext}). Binary content is not inlined — use the path if you need to open or process it:\n${fileUri}`,
          uri: {
            type: "file",
            value: fileUri,
          },
        },
      ];
    }

    let content: string;
    try {
      content = await extras.ide.readRangeInFile(fileUri, {
        start: { line: 0, character: 0 },
        end: { line: MAX_FILE_CONTEXT_LINES, character: 0 },
      });
    } catch {
      content = await extras.ide.readFile(fileUri);
    }

    // Null-byte / obvious binary slip past the extension list.
    if (content.includes("\u0000")) {
      return [
        {
          name: baseName,
          description: last2Parts,
          content: `Attached binary file \`${relativePathOrBasename}\`. Content is not inlined:\n${fileUri}`,
          uri: {
            type: "file",
            value: fileUri,
          },
        },
      ];
    }

    return [
      {
        name: baseName,
        description: last2Parts,
        content: `\`\`\`${relativePathOrBasename}\n${content}\n\`\`\``,
        uri: {
          type: "file",
          value: fileUri,
        },
      },
    ];
  }

  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    const workspaceDirs = await args.ide.getWorkspaceDirs();
    if (!workspaceDirs || workspaceDirs.length === 0) {
      return [];
    }

    // Two passes: general workspace files + an explicit media glob so images /
    // videos / PDFs are not drowned by the first N source files in a large repo.
    const [generalResults, mediaResults] = await Promise.all([
      args.ide.getFileResults("**/*", MAX_GENERAL_SUBMENU_ITEMS, {
        includeMedia: true,
      }),
      args.ide.getFileResults(MEDIA_ATTACH_FIND_GLOB, MAX_MEDIA_SUBMENU_ITEMS, {
        includeMedia: true,
      }),
    ]);

    const workspaceFiles = resolveWorkspaceFileUris(
      [...generalResults, ...mediaResults],
      workspaceDirs,
    );

    const seen = new Set<string>();
    const merged: ContextSubmenuItem[] = [];
    for (const item of toSubmenuItems(workspaceFiles, workspaceDirs)) {
      if (seen.has(item.id) || merged.length >= MAX_SUBMENU_ITEMS) {
        continue;
      }
      seen.add(item.id);
      merged.push(item);
    }

    return merged;
  }
}

export default FileContextProvider;
