import { allModelProviders } from "llm-info";

const AUTODETECT = "AUTODETECT";

/** Cap noisy OpenAI-compatible /models listings. */
const OPENAI_FAMILY = new Set([
  "openai",
  "openai-aiohttp",
  "azure",
  "groq",
  "together",
  "fireworks",
  "deepseek",
  "nvidia",
  "openrouter",
  "cometapi",
]);

/**
 * Filter live /models results so Roles / toggler stay usable.
 */
export function filterListedModelNames(
  provider: string,
  names: string[],
): string[] {
  const unique = Array.from(
    new Set(
      names
        .map((n) => n.trim())
        .filter((n) => n.length > 0 && n.toUpperCase() !== AUTODETECT),
    ),
  );

  if (!OPENAI_FAMILY.has(provider)) {
    return unique;
  }

  return unique
    .filter((n) => {
      const lower = n.toLowerCase();
      if (lower.includes("embed") || lower.includes("whisper")) {
        return false;
      }
      if (lower.includes("instruct") && !lower.startsWith("gpt-")) {
        return false;
      }
      return (
        /^(gpt-|o[1-9]|chatgpt-|claude-|gemini-|llama|mistral|mixtral|qwen|deepseek|command|grok)/i.test(
          n,
        ) || lower.includes("/")
      );
    })
    .slice(0, 100);
}

/**
 * Curated fallback when listModels() is empty (Anthropic, Gemini, etc.).
 * Uses llm-info catalogs shared with the rest of the stack.
 */
export function catalogModelNamesForProvider(provider: string): string[] {
  const match = allModelProviders.find(
    (p) => p.id === provider || p.id.toLowerCase() === provider.toLowerCase(),
  );
  if (!match) {
    return [];
  }
  return match.models
    .map((m) => m.model)
    .filter((m) => typeof m === "string" && m.length > 0 && m !== AUTODETECT);
}

export { AUTODETECT };
