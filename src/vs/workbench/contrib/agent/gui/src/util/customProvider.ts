export const CUSTOM_OPENAI_PROVIDER_ID_PREFIX = "custom-openai-";

export function customOpenAIProviderId(name: string, apiBase: string): string {
	const slug =
		name
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "")
			.slice(0, 32) || "provider";
	const endpoint = new URL(normalizeCustomOpenAIApiBase(apiBase));
	const identity = `${endpoint.origin}${endpoint.pathname.replace(/\/+$/, "")}`.toLowerCase();
	let hash = 2166136261;
	for (let index = 0; index < identity.length; index++) {
		hash = Math.imul(hash ^ identity.charCodeAt(index), 16777619);
	}
	return `${CUSTOM_OPENAI_PROVIDER_ID_PREFIX}${slug}--${(hash >>> 0).toString(36)}`;
}

export function isCustomOpenAIProviderId(provider: string): boolean {
	return provider.startsWith(CUSTOM_OPENAI_PROVIDER_ID_PREFIX);
}

export function normalizeCustomOpenAIApiBase(apiBase: string): string {
	const url = new URL(apiBase.trim());
	if (!["http:", "https:"].includes(url.protocol) || !url.hostname) {
		throw new Error("Enter a valid HTTP or HTTPS API base URL.");
	}
	if (url.username || url.password) {
		throw new Error("Remove credentials from the URL and enter them as an API key.");
	}
	url.hash = "";
	return url.toString().replace(/\/$/, "");
}
