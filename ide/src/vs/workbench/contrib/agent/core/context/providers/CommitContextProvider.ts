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
    const selected = parseGitContextId(query, "commit");
    const lastXCommitsDepth = this.options?.LastXCommitsDepth ?? 10;
    const workspaceDirs = await extras.ide.getWorkspaceDirs();
    if (workspaceDirs.length === 0) {
      return [];
    }

    const dirs = selected ? [selected.dir] : workspaceDirs;
    const recentShortcut = selected?.id.startsWith("last ") ?? query.includes("last ");
    const commitId = selected && !recentShortcut ? selected.id : query;
    const results = await Promise.all(
      dirs.map(async (dir) => {
        try {
          if (recentShortcut) {
            const branch = await extras.ide.getBranch(dir);
            const ref = (await extras.ide.getGitRefs(dir)).find(
              (item) => item.name === branch,
            );
            const commits = ref
              ? await extras.ide.getGitHistory(
                  dir,
                  ref.revision ?? ref.id,
                  lastXCommitsDepth,
                )
              : [];
            const content = (
              await Promise.all(
                commits.map(async (commit) => {
                  const context = await extras.ide.getGitCommitContext(
                    dir,
                    commit.id,
                  );
                  return [
                    `Commit: ${commit.id}`,
                    commit.message,
                    context,
                  ]
                    .filter(Boolean)
                    .join("\n");
                }),
              )
            ).join("\n\n");
            if (!content) {
              return undefined;
            }
            const label =
              workspaceDirs.length > 1
                ? ` (${workspaceLabel(dir, workspaceDirs)})`
                : "";
            return {
              name: `last ${lastXCommitsDepth} commits${label}`,
              description: `recent commits${label}`,
              content,
            };
          }

          const content = await extras.ide.getGitCommitContext(dir, commitId);
          if (!content) {
            return undefined;
          }
          const label =
            workspaceDirs.length > 1
              ? ` (${workspaceLabel(dir, workspaceDirs)})`
              : "";
          return {
            name: `${commitId}${label}`,
            description: `commit ${commitId}${label}`,
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
    const depth = this.options?.Depth ?? 50;
    const lastXCommitsDepth = this.options?.LastXCommitsDepth ?? 10;
    const workspaceDirs = await args.ide.getWorkspaceDirs();
    if (workspaceDirs.length === 0) {
      return [
        {
          id: `last ${lastXCommitsDepth} commits`,
          title: `last ${lastXCommitsDepth} commits`,
          description: "recent commits with diffs",
        },
      ];
    }

    const groups = await Promise.all(
      workspaceDirs.map(async (dir) => {
        const label =
          workspaceDirs.length > 1
            ? ` · ${workspaceLabel(dir, workspaceDirs)}`
            : "";
        const recent: ContextSubmenuItem = {
          id: makeGitContextId(
            "commit",
            dir,
            `last ${lastXCommitsDepth} commits`,
          ),
          title: `last ${lastXCommitsDepth} commits${label}`,
          description: `recent commits with diffs${label}`,
        };
        try {
          const branch = await args.ide.getBranch(dir);
          const ref = (await args.ide.getGitRefs(dir)).find(
            (item) => item.name === branch,
          );
          const commits = ref
            ? await args.ide.getGitHistory(
                dir,
                ref.revision ?? ref.id,
                depth,
              )
            : [];
          return [
            recent,
            ...commits.map((commit) => ({
              id: makeGitContextId("commit", dir, commit.id),
              title: `${commit.subject}${label}`,
              description: commit.displayId ?? commit.id.slice(0, 8),
            })),
          ];
        } catch {
          return [recent];
        }
      }),
    );
    return groups.flat();
  }
}

export default CommitContextProvider;
