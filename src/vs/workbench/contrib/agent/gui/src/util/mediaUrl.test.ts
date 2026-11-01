import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { providerLogoUrl, staticAssetUrl } from "./mediaUrl";

describe("mediaUrl", () => {
  const originalVscMediaUrl = window.vscMediaUrl;

  beforeEach(() => {
    window.vscMediaUrl = "https://example.test/webview/";
  });

  afterEach(() => {
    window.vscMediaUrl = originalVscMediaUrl;
  });

  it("builds static asset URLs from vscMediaUrl", () => {
    expect(staticAssetUrl("test_asset.png")).toBe(
      "https://example.test/webview/test_asset.png",
    );
  });

  it("builds provider logo URLs under logos/", () => {
    expect(providerLogoUrl("openai.png")).toBe(
      "https://example.test/webview/logos/openai.png",
    );
  });

  it("returns undefined when vscMediaUrl is unset", () => {
    window.vscMediaUrl = "";
    expect(providerLogoUrl("openai.png")).toBeUndefined();
  });
});
