import { afterEach, describe, expect, it, vi } from "vitest";
import { IdeMessenger } from "./IdeMessenger";

describe("IdeMessenger request lifecycle", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("fails boundedly when the extension host does not respond", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("vscode", { postMessage: vi.fn() });
    const messenger = new IdeMessenger();
    const request = messenger.request("getIdeInfo", undefined);
    const rejection = expect(request).rejects.toThrow(
      "The agent request timed out while waiting for getIdeInfo.",
    );

    await vi.advanceTimersByTimeAsync(30_000);

    await rejection;
  });

  it("settles immediately when the stream is already cancelled", async () => {
    const postMessage = vi.fn();
    vi.stubGlobal("vscode", { postMessage });
    vi.stubGlobal("window", new EventTarget());
    const messenger = new IdeMessenger();
    const controller = new AbortController();
    controller.abort();

    const generator = messenger.streamRequest(
      "llm/streamChat",
      {} as never,
      controller.signal,
    );
    const result = await generator.next();

    expect(result.done).toBe(true);
    expect(postMessage).toHaveBeenCalledTimes(2);
  });
});
