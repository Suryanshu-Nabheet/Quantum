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
});
