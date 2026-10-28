import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../../index.js";
import { BaseContextProvider } from "../index.js";
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
    const branch = query.trim();
    const workspaceDirs = await extras.ide.getWorkspaceDirs();
    const dir = workspaceDirs[0];
    if (!branch || !dir) {
      return [];
    }

    try {
      const refs = await extras.ide.getGitRefs(dir);
      const ref = refs.find((item) => item.name === branch || item.id === branch);
      if (!ref) { return []; }
      const currentBranch = await extras.ide.getBranch(dir);
      const commits = await extras.ide.getGitHistory(dir, ref.id, MAX_BRANCH_LOG_COMMITS);

      const content = [
        `Branch: ${branch}`,
        currentBranch ? `Current branch: ${currentBranch}` : undefined,
        commits.length ? `Recent commits:\n${commits.map(commit => `${commit.displayId ?? commit.id.slice(0, 8)} ${commit.subject}`).join("\n")}` : undefined,
      ]
        .filter(Boolean)
        .join("\n\n");

      return [
        {
          name: branch,
          description: `branch ${branch}`,
          content,
        },
      ];
    } catch {
      return [];
    }
  }

  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    const workspaceDirs = await args.ide.getWorkspaceDirs();
    const dir = workspaceDirs[0];
    if (!dir) {
      return [];
    }

    try {
      return (await args.ide.getGitRefs(dir))
        .slice(0, MAX_BRANCH_SUBMENU_ITEMS)
        .map((ref) => ({ id: ref.name, title: ref.name, description: ref.revision?.slice(0, 8) ?? "" }))
        .filter((branch) => !branch.id.endsWith("/HEAD"));
    } catch {
      return [];
    }
  }
}

export default BranchContextProvider;
