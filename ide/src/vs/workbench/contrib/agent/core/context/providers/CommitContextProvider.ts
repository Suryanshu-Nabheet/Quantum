import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../../index.js";
import { BaseContextProvider } from "../index.js";
import { gitWorkingDirectory, runGitCommand } from "./git.js";

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
    const cwd = gitWorkingDirectory(workspaceDirs);
    if (!cwd) {
      return [];
    }

    try {
      if (query.includes("last ")) {
        const content = await runGitCommand(
          extras.ide,
          [
            "--no-pager",
            "log",
            '--pretty=format:"%H,%h,%an,%ae,%ad,%P,%s,%b"',
            "-p",
            "-n",
            String(lastXCommitsDepth),
          ],
          cwd,
        );
        return [
          {
            name: query,
            description: query,
            content,
          },
        ];
      }

      const content = await runGitCommand(
        extras.ide,
        [
          "--no-pager",
          "show",
          '--pretty=format:"%H,%h,%an,%ae,%ad,%P,%s,%b"',
          query,
        ],
        cwd,
      );
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
    const cwd = gitWorkingDirectory(workspaceDirs);
    const recentCommits: ContextSubmenuItem[] = [
      {
        id: `last ${lastXCommitsDepth} commits`,
        title: `last ${lastXCommitsDepth} commits`,
        description: "recent commits with diffs",
      },
    ];
    if (!cwd) {
      return recentCommits;
    }

    try {
      const gitResult = await runGitCommand(
        args.ide,
        [
          "--no-pager",
          "log",
          '--pretty=format:"%H%x00%s"',
          "-n",
          String(depth),
        ],
        cwd,
      );

      const commits = gitResult
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          let [hash, message] = line.split("\0");
          hash = hash.replace(/"/g, "");
          message = message.replace(/"/g, "");
          return {
            id: hash,
            title: message,
            description: hash.slice(0, 8),
          };
        });

      return recentCommits.concat(commits);
    } catch {
      return recentCommits;
    }
  }
}

export default CommitContextProvider;
