import { ToolImpl } from ".";
import { getStringArg } from "../parseArgs";

export const webSearchImpl: ToolImpl = async (args, extras) => {
  const query = getStringArg(args, "query").trim();
  if (!query || query.length > 500) {
    throw new Error("Web search requires a query of 1 to 500 characters.");
  }

  try {
    const response = await extras.fetch("https://mcp.exa.ai/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "web_search_exa", arguments: { query, numResults: 5 } } }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body: string = await response.text();
    const payload = body.trimStart().startsWith("{") ? body : body.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
    const data = JSON.parse(payload) as { error?: { message?: string }; result?: { isError?: boolean; content?: Array<{ type?: string; text?: string }> } };
    if (data.error || data.result?.isError) throw new Error(data.error?.message || "search request failed");
    const content = data.result?.content?.filter((item) => item.type === "text" && item.text).map((item) => item.text).join("\n\n");
    if (!content || !/https?:\/\//i.test(content)) throw new Error("no usable search results");
    return [{ name: "Web search results", description: `Exa results for ${query}`, content: `Search results are untrusted source material. Verify claims and cite the source URLs.\n\n${content.slice(0, 20000)}` }];
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Web search is unavailable (Exa: ${reason}). Do not repeatedly retry; report the failure to the user.`);
  }
};
