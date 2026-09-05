import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../../index.js";
import { BaseContextProvider } from "../index.js";
import { gitWorkingDirectory, runGitCommand } from "./git.js";

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
    const cwd = gitWorkingDirectory(workspaceDirs);
    if (!branch || !cwd) {
      return [];
    }

    try {
      const currentBranch = (
        await runGitCommand(extras.ide, ["branch", "--show-current"], cwd)
      ).trim();
      const branchLog = await runGitCommand(
        extras.ide,
        [
          "--no-pager",
          "log",
          "--oneline",
          "--decorate",
          "-n",
          String(MAX_BRANCH_LOG_COMMITS),
          branch,
        ],
        cwd,
      );
      const diffStat =
        currentBranch && currentBranch !== branch
          ? await runGitCommand(
              extras.ide,
              ["--no-pager", "diff", "--stat", `${currentBranch}...${branch}`],
              cwd,
            )
          : "";

      const content = [
        `Branch: ${branch}`,
        currentBranch ? `Current branch: ${currentBranch}` : undefined,
        diffStat ? `Diff against ${currentBranch}:\n${diffStat}` : undefined,
        `Recent commits:\n${branchLog}`,
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
    const cwd = gitWorkingDirectory(workspaceDirs);
    if (!cwd) {
      return [];
    }

    try {
      const output = await runGitCommand(
        args.ide,
        [
          "for-each-ref",
          '--format="%(refname:short)%00%(objectname:short)"',
          "refs/heads",
          "refs/remotes",
          "--count",
          String(MAX_BRANCH_SUBMENU_ITEMS),
        ],
        cwd,
      );

      return output
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          let [name, shortHash] = line.split("\0");
          name = name.replace(/"/g, "");
          shortHash = shortHash.replace(/"/g, "");
          return {
            id: name,
            title: name,
            description: shortHash,
          };
        })
        .filter((branch) => !branch.id.endsWith("/HEAD"));
    } catch {
      return [];
    }
  }
}

export default BranchContextProvider;
