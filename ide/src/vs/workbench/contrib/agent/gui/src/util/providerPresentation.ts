interface ProviderPresentation {
	readonly id: string;
	readonly title: string;
	readonly apiKeyUrl?: string;
}

const PROVIDERS: readonly ProviderPresentation[] = [
	{
		id: "cometapi",
		title: "CometAPI",
		apiKeyUrl: "https://api.cometapi.com/console/token",
	},
	{
		id: "openai",
		title: "OpenAI",
		apiKeyUrl: "https://platform.openai.com/account/api-keys",
	},
	{
		id: "anthropic",
		title: "Anthropic",
		apiKeyUrl: "https://console.anthropic.com/account/keys",
	},
	{
		id: "openrouter",
		title: "OpenRouter",
		apiKeyUrl: "https://openrouter.ai/settings/keys",
	},
	{
		id: "moonshot",
		title: "Moonshot",
		apiKeyUrl: "https://docs.moonshot.cn/docs/getting-started",
	},
	{
		id: "zAI",
		title: "Z.ai",
		apiKeyUrl: "https://z.ai/manage-apikey/apikey-list",
	},
	{
		id: "function-network",
		title: "Function Network",
		apiKeyUrl: "https://function.network/join-waitlist",
	},
	{
		id: "ovhcloud",
		title: "OVHcloud",
		apiKeyUrl: "https://endpoints.ai.cloud.ovh.net/",
	},
	{
		id: "scaleway",
		title: "Scaleway",
		apiKeyUrl: "https://console.scaleway.com/iam/api-keys",
	},
	{
		id: "azure",
		title: "Azure OpenAI",
		apiKeyUrl:
			"https://azure.microsoft.com/en-us/products/ai-services/openai-service",
	},
	{
		id: "mistral",
		title: "Mistral",
		apiKeyUrl: "https://console.mistral.ai/codestral",
	},
	{
		id: "mimo",
		title: "Xiaomi Mimo",
		apiKeyUrl: "https://platform.xiaomimimo.com/",
	},
	{ id: "ollama", title: "Ollama" },
	{
		id: "cohere",
		title: "Cohere",
		apiKeyUrl: "https://docs.cohere.com/v2/docs/rate-limits",
	},
	{ id: "groq", title: "Groq", apiKeyUrl: "https://console.groq.com/keys" },
	{
		id: "deepseek",
		title: "DeepSeek",
		apiKeyUrl: "https://platform.deepseek.com/api_keys",
	},
	{
		id: "together",
		title: "TogetherAI",
		apiKeyUrl: "https://api.together.xyz/settings/api-keys",
	},
	{
		id: "ncompass",
		title: "nCompass",
		apiKeyUrl: "https://app.ncompass.tech/api-settings",
	},
	{
		id: "novita",
		title: "NovitaAI",
		apiKeyUrl: "https://novita.ai/settings/key-management",
	},
	{
		id: "gemini",
		title: "Google Gemini API",
		apiKeyUrl: "https://aistudio.google.com/app/apikey",
	},
	{ id: "xAI", title: "xAI", apiKeyUrl: "https://console.x.ai/" },
	{ id: "lemonade", title: "Lemonade" },
	{ id: "lmstudio", title: "LM Studio" },
	{ id: "llamafile", title: "llamafile" },
	{ id: "llama.cpp", title: "llama.cpp" },
	{
		id: "watsonx",
		title: "IBM watsonx",
		apiKeyUrl:
			"https://dataplatform.cloud.ibm.com/registration/stepone?context=wx",
	},
	{
		id: "sambanova",
		title: "SambaNova",
		apiKeyUrl: "https://cloud.sambanova.ai/apis",
	},
	{
		id: "cerebras",
		title: "Cerebras",
		apiKeyUrl: "https://cloud.cerebras.ai/",
	},
	{ id: "vertexai", title: "VertexAI" },
	{ id: "askSage", title: "Ask Sage", apiKeyUrl: "https://chat.asksage.ai/" },
	{
		id: "nebius",
		title: "Nebius AI Studio",
		apiKeyUrl: "https://studio.nebius.ai/settings/api-keys",
	},
	{
		id: "siliconflow",
		title: "SiliconFlow",
		apiKeyUrl: "https://cloud.siliconflow.cn/account/ak",
	},
	{ id: "tensorix", title: "Tensorix", apiKeyUrl: "https://app.tensorix.ai" },
	{ id: "venice", title: "Venice", apiKeyUrl: "https://venice.ai/chat" },
	{
		id: "tars",
		title: "Tetrate Agent Router Service",
		apiKeyUrl: "https://api.router.tetrate.ai/",
	},
	{
		id: "nous",
		title: "Nous Research",
		apiKeyUrl: "https://portal.nousresearch.com",
	},
];

export function getProviderPresentation(
	providerId: string | undefined | null,
): ProviderPresentation | undefined {
	const normalizedId = (providerId ?? "").trim().toLowerCase();
	if (!normalizedId) {
		return undefined;
	}

	return PROVIDERS.find(
		(provider) =>
			provider.id.toLowerCase() === normalizedId ||
			provider.title.toLowerCase() === normalizedId,
	);
}

export function getProviderPresentationExact(
	providerId: string | undefined | null,
): ProviderPresentation | undefined {
	return PROVIDERS.find(provider => provider.id === providerId);
}
