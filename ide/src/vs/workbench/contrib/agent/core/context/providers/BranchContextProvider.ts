import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../../index.js";
import { BaseContextProvider } from "../index.js";
import {
  makeGitContextId,
  parseGitContextId,
  workspaceLabel,
} from "./gitContextUtils.js";
const MAX_BRANCH_SUBMENU_ITEMS = 100;
const MAX_BRANCH_LOG_COMMITS = 30;

class BranchContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "branch",
    displayTitle: "Branches",
    description: "Reference git branches",
    type: "submenu",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const selected = parseGitContextId(query.trim(), "branch");
    const branch = selected?.id ?? query.trim();
    const workspaceDirs = await extras.ide.getWorkspaceDirs();
    if (!branch || workspaceDirs.length === 0) {
      return [];
    }

    const dirs = selected ? [selected.dir] : workspaceDirs;
    const results = await Promise.all(
      dirs.map(async (dir) => {
        try {
          const refs = await extras.ide.getGitRefs(dir);
          const ref = refs.find(
            (item) => item.name === branch || item.id === branch,
          );
          if (!ref) {
            return undefined;
          }
          const currentBranch = await extras.ide.getBranch(dir);
          const commits = await extras.ide.getGitHistory(
            dir,
            ref.revision ?? ref.id,
            MAX_BRANCH_LOG_COMMITS,
          );
          const label =
            workspaceDirs.length > 1
              ? ` (${workspaceLabel(dir, workspaceDirs)})`
              : "";
          const content = [
            `Branch: ${branch}${label}`,
            currentBranch ? `Current branch: ${currentBranch}` : undefined,
            commits.length
              ? `Recent commits:\n${commits
                  .map(
                    (commit) =>
                      `${commit.displayId ?? commit.id.slice(0, 8)} ${commit.subject}`,
                  )
                  .join("\n")}`
              : undefined,
          ]
            .filter(Boolean)
            .join("\n\n");
          return {
            name: `${branch}${label}`,
            description: `branch ${branch}${label}`,
            content,
          };
        } catch {
          return undefined;
        }
      }),
    );
    return results.filter(
      (item): item is NonNullable<typeof item> => item !== undefined,
    );
  }

  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    const workspaceDirs = await args.ide.getWorkspaceDirs();
    if (workspaceDirs.length === 0) {
      return [];
    }

    const groups = await Promise.all(
      workspaceDirs.map(async (dir) => {
        try {
          const refs = await args.ide.getGitRefs(dir);
          return refs
            .slice(0, MAX_BRANCH_SUBMENU_ITEMS)
            .filter((ref) => !ref.name.endsWith("/HEAD"))
            .map((ref) => {
              const label =
                workspaceDirs.length > 1
                  ? ` · ${workspaceLabel(dir, workspaceDirs)}`
                  : "";
              return {
                id: makeGitContextId("branch", dir, ref.name),
                title: `${ref.name}${label}`,
                description: ref.revision?.slice(0, 8) ?? "",
              };
            });
        } catch {
          return [];
        }
      }),
    );
    return groups.flat();
  }
}

export default BranchContextProvider;
