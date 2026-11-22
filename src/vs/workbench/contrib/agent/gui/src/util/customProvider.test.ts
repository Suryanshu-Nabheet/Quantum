import { describe, expect, it } from "vitest";
import {
	customOpenAIProviderId,
	isCustomOpenAIProviderId,
	normalizeCustomOpenAIApiBase,
} from "./customProvider";

describe("custom OpenAI-compatible provider settings", () => {
	it("creates stable and endpoint-specific provider identities", () => {
		const first = customOpenAIProviderId("My Local Server", "http://localhost:1234/v1");

		expect(first).toBe(customOpenAIProviderId("My Local Server", "http://localhost:1234/v1/"));
		expect(isCustomOpenAIProviderId(first)).toBe(true);
		expect(customOpenAIProviderId("My Local Server", "http://localhost:5678/v1")).not.toBe(first);
	});

	it("normalizes local HTTP endpoints and removes fragments", () => {
		expect(normalizeCustomOpenAIApiBase("http://localhost:1234/v1/#section")).toBe(
			"http://localhost:1234/v1",
		);
	});

	it("rejects unsupported protocols and credentials embedded in the URL", () => {
		expect(() => normalizeCustomOpenAIApiBase("ftp://localhost/v1")).toThrow(
			"Enter a valid HTTP or HTTPS API base URL.",
		);
		expect(() => normalizeCustomOpenAIApiBase("http://user:pass@localhost/v1")).toThrow(
			"Remove credentials from the URL and enter them as an API key.",
		);
	});
});
