import { getDiffsFromCache } from "../../autocomplete/snippets/gitDiffCache.js";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../../index.js";
import { BaseContextProvider } from "../index.js";

class DiffContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "diff",
    displayTitle: "Git Diff",
    description: "Reference the current git diff",
    type: "normal",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const includeUnstaged = this.options?.includeUnstaged ?? true;
    const diffs = await getDiffsFromCache(extras.ide, includeUnstaged);
    return [
      {
        description: "The current git diff",
        content:
          diffs.length === 0
            ? "Git shows no current changes."
            : `\`\`\`git diff\n${diffs.join("\n")}\n\`\`\``,
        name: "Git Diff",
      },
    ];
  }
}

export default DiffContextProvider;
