import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../../index.js";
import { BaseContextProvider } from "../index.js";

class BrowserContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "browser",
    displayTitle: "Browser",
    description: "Integrated browser tabs",
    type: "normal",
    renderInlineAs: "",
  };

  async getContextItems(
    _query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const pages = await extras.ide.getBrowserPages();

    if (!pages.length) {
      return [
        {
          name: "Browser",
          description: "No open tabs",
          content:
            "No integrated browser tabs are open. Open a page in the integrated browser, share it with the agent, then use browser tools (read_page, click_element, navigate_page, etc.) or @browser for context.",
        },
      ];
    }

    const contentParts: string[] = [];

    for (const page of pages) {
      await extras.ide.ensureBrowserPageShared(page.id);
      const pageContent = await extras.ide.getBrowserPageContext(page.id);
      if (pageContent) {
        contentParts.push(pageContent);
      }
    }

    const activePage = pages.find((page) => page.isActive) ?? pages[0];

    return [
      {
        name: "Browser",
        description: activePage.title || activePage.url || `${pages.length} open tab(s)`,
        content:
          contentParts.join("\n\n---\n\n") ||
          "Open browser tabs were found, but no page context could be collected.",
        uri: activePage.resource
          ? {
              type: "url",
              value: activePage.resource,
            }
          : undefined,
      },
    ];
  }
}

export default BrowserContextProvider;
