import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../../index.js";
import { BaseContextProvider } from "../index.js";
class CommitContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "commit",
    displayTitle: "Commits",
    description: "Reference git commits",
    type: "submenu",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const lastXCommitsDepth = this.options?.LastXCommitsDepth ?? 10;
    const workspaceDirs = await extras.ide.getWorkspaceDirs();
    const dir = workspaceDirs[0];
    if (!dir) {
      return [];
    }

    try {
      if (query.includes("last ")) {
        const branch = await extras.ide.getBranch(dir);
        const ref = (await extras.ide.getGitRefs(dir)).find(item => item.name === branch);
        const commits = ref ? await extras.ide.getGitHistory(dir, ref.id, lastXCommitsDepth) : [];
        const content = (await Promise.all(commits.map(async commit => {
          const context = await extras.ide.getGitCommitContext(dir, commit.id);
          return [`Commit: ${commit.id}`, commit.message, context].filter(Boolean).join("\n");
        }))).join("\n\n");
        return [
          {
            name: query,
            description: query,
            content,
          },
        ];
      }

      const content = await extras.ide.getGitCommitContext(dir, query);
      if (!content) { return []; }
      return [
        {
          name: query,
          description: `commit ${query}`,
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
    const depth = this.options?.Depth ?? 50;
    const lastXCommitsDepth = this.options?.LastXCommitsDepth ?? 10;
    const workspaceDirs = await args.ide.getWorkspaceDirs();
    const dir = workspaceDirs[0];
    const recentCommits: ContextSubmenuItem[] = [
      {
        id: `last ${lastXCommitsDepth} commits`,
        title: `last ${lastXCommitsDepth} commits`,
        description: "recent commits with diffs",
      },
    ];
    if (!dir) {
      return recentCommits;
    }

    try {
      const branch = await args.ide.getBranch(dir);
      const ref = (await args.ide.getGitRefs(dir)).find(item => item.name === branch);
      const commits = ref ? await args.ide.getGitHistory(dir, ref.id, depth) : [];
      const items = commits.map(commit => ({
        id: commit.id,
        title: commit.subject,
        description: commit.displayId ?? commit.id.slice(0, 8),
      }));

      return recentCommits.concat(items);
    } catch {
      return recentCommits;
    }
  }
}

export default CommitContextProvider;
