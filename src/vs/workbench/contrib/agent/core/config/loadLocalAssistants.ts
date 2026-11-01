import ignore from "ignore";
import * as URI from "uri-js";
import { IDE } from "..";
import {
  DEFAULT_IGNORE_DIRS,
  DEFAULT_IGNORE_FILETYPES,
} from "../indexing/ignore";
import { walkDir } from "../indexing/walkDir";
import { RULES_MARKDOWN_FILENAME } from "../llm/rules/constants";
import { getGlobalFolderWithName } from "../util/paths";
import { localPathToUri } from "../util/pathToUri";
import { getUriPathBasename, joinPathsToUri } from "../util/uri";
import { SUPPORTED_AGENT_FILES } from "./markdown";

export const SYSTEM_PROMPT_DOT_FILE = ".agentrules";

/** URIs that should trigger a config reload when created/updated/deleted. */
export function isAgentConfigRelatedUri(uri: string): boolean {
  const normalized = URI.normalize(uri);
  return (
    uri.endsWith(SYSTEM_PROMPT_DOT_FILE) ||
    !!SUPPORTED_AGENT_FILES.find((file) => uri.endsWith(`/${file}`))
  );
}

export function isColocatedRulesFile(uri: string): boolean {
  return getUriPathBasename(uri) === RULES_MARKDOWN_FILENAME;
}

async function getMarkdownFilesInDir(
  ide: IDE,
  dir: string,
): Promise<{ path: string; content: string }[]> {
  try {
    const exists = await ide.fileExists(dir);
    if (!exists) {
      return [];
    }

    const overrideDefaultIgnores = ignore()
      .add(DEFAULT_IGNORE_FILETYPES)
      .add(DEFAULT_IGNORE_DIRS);

    const uris = await walkDir(dir, ide, {
      overrideDefaultIgnores,
      source: "get agent markdown files",
    });
    const markdownPaths = uris.filter((p) => p.endsWith(".md"));

    return Promise.all(
      markdownPaths.map(async (uri) => ({
        path: uri,
        content: await ide.readFile(uri),
      })),
    );
  } catch (e) {
    console.error(e);
    return [];
  }
}

export interface LoadAssistantFilesOptions {
  includeGlobal: boolean;
  includeWorkspace: boolean;
}

export function getDotAgentSubDirs(
  ide: IDE,
  options: LoadAssistantFilesOptions,
  workspaceDirs: string[],
  subDirName: string,
): string[] {
  const fullDirs: string[] = [];

  if (options.includeWorkspace) {
    fullDirs.push(
      ...workspaceDirs.map((dir) =>
        joinPathsToUri(dir, ".agent", subDirName),
      ),
    );
  }

  if (options.includeGlobal) {
    fullDirs.push(localPathToUri(getGlobalFolderWithName(subDirName)));
  }

  return fullDirs;
}

/** Markdown files under `.agent/<subDir>` in workspace and global dirs. */
export async function getAllDotAgentDefinitionFiles(
  ide: IDE,
  options: LoadAssistantFilesOptions,
  subDirName: string,
): Promise<{ path: string; content: string }[]> {
  const workspaceDirs = await ide.getWorkspaceDirs();
  const fullDirs = getDotAgentSubDirs(ide, options, workspaceDirs, subDirName);

  const definitionFiles = (
    await Promise.all(fullDirs.map((dir) => getMarkdownFilesInDir(ide, dir)))
  ).flat();

  return definitionFiles;
}
