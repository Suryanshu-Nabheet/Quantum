import { ModelDescription } from "core";
import { providers } from "../pages/AddNewModel/configs/providers";

const AUTODETECT = "autodetect";

/** Providers that route many upstream org/model slugs through one API key. */
const MODEL_GATEWAY_PROVIDER_IDS = new Set([
  "openrouter",
  "cometapi",
  "function-network",
]);

const TOKEN_ACRONYMS: Record<string, string> = {
  ai: "AI",
  api: "API",
  gpt: "GPT",
  deepseek: "DeepSeek",
  glm: "GLM",
  llm: "LLM",
  o1: "O1",
  o3: "O3",
  vllm: "vLLM",
  zai: "Z.AI",
};

function isAutodetect(value: string | undefined | null): boolean {
  const v = (value ?? "").trim();
  if (!v) {
    return true;
  }
  return v.toLowerCase() === AUTODETECT || v.toUpperCase() === "AUTODETECT";
}

/** Raw model slug from config (before display formatting). */
export function getRawModelSlug(
  model: Pick<ModelDescription, "model" | "title"> | null | undefined,
): string {
  if (!model) {
    return "";
  }
  const fromModel = (model.model ?? "").trim();
  if (fromModel && !isAutodetect(fromModel)) {
    return fromModel;
  }
  const fromTitle = (model.title ?? "").trim();
  if (fromTitle && !isAutodetect(fromTitle)) {
    return fromTitle;
  }
  return "";
}

function isSlugLike(value: string): boolean {
  const v = value.trim();
  if (!v) {
    return false;
  }
  if (v.startsWith("~") || v.includes("/")) {
    return true;
  }
  if (/\s/.test(v)) {
    return false;
  }
  return /^[a-z0-9][a-z0-9._-]*$/i.test(v);
}

function formatToken(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) {
    return "";
  }
  const lower = trimmed.toLowerCase();
  if (TOKEN_ACRONYMS[lower]) {
    return TOKEN_ACRONYMS[lower];
  }
  if (/^v\d/.test(lower)) {
    return trimmed.toUpperCase();
  }
  if (/^\d+(\.\d+)*$/.test(trimmed)) {
    return trimmed;
  }
  if (/^[A-Z0-9]+(?:\.[A-Z0-9]+)*$/.test(trimmed)) {
    return trimmed;
  }
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function formatSlugSegment(segment: string): string {
  const cleaned = segment.replace(/_/g, "-").trim();
  if (!cleaned) {
    return "";
  }
  return cleaned
    .split("-")
    .filter(Boolean)
    .map(formatToken)
    .join(" ");
}

/**
 * Turn routing slugs (`~openai/gpt-terra-latest`, `aion-labs/aion-3.5`) into readable names.
 */
export function formatModelDisplayName(raw: string | undefined | null): string {
  let value = (raw ?? "").trim();
  if (!value || isAutodetect(value)) {
    return "";
  }
  if (value.startsWith("~")) {
    value = value.slice(1);
  }

  const slashIndex = value.indexOf("/");
  const namePart =
    slashIndex >= 0 ? value.slice(slashIndex + 1).trim() : value.trim();

  if (!namePart) {
    return formatSlugSegment(value.replace(/\//g, " "));
  }

  const formatted = formatSlugSegment(namePart);
  return formatted || value;
}

function parseModelSlugParts(raw: string): { org?: string; name: string } {
  let value = (raw ?? "").trim();
  if (value.startsWith("~")) {
    value = value.slice(1);
  }
  const slashIndex = value.indexOf("/");
  if (slashIndex < 0) {
    return { name: value };
  }
  const org = value.slice(0, slashIndex).trim();
  const name = value.slice(slashIndex + 1).trim();
  return { org: org || undefined, name: name || value };
}

const ORG_SLUG_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  deepseek: "DeepSeek",
  "aion-labs": "Aion Labs",
  "z-ai": "Z.AI",
  xai: "xAI",
  google: "Google",
  meta: "Meta",
  mistral: "Mistral",
};

function formatOrgSlug(org: string): string {
  const key = org.trim().toLowerCase();
  if (ORG_SLUG_LABELS[key]) {
    return ORG_SLUG_LABELS[key];
  }
  return formatSlugSegment(org.replace(/\//g, "-"));
}

/** Resolve a human provider label (e.g. OpenAI, Ollama). */
export function getProviderDisplayName(
  providerId: string | undefined | null,
): string {
  const id = (providerId ?? "").trim();
  if (!id) {
    return "Provider";
  }
  const match = Object.values(providers).find(
    (p) =>
      p?.provider === id ||
      p?.provider?.toLowerCase() === id.toLowerCase() ||
      p?.title?.toLowerCase() === id.toLowerCase(),
  );
  if (match?.title) {
    return match.title;
  }
  return formatSlugSegment(id.replace(/\//g, "-")) || id;
}

/** Secondary column in the model picker — upstream org when routed through a gateway. */
export function getModelPickerProviderLabel(
  model:
    | Pick<
        ModelDescription,
        "provider" | "underlyingProviderName" | "model" | "title"
      >
    | null
    | undefined,
): string {
  if (!model) {
    return "Provider";
  }
  const gatewayId = (
    model.underlyingProviderName ||
    model.provider ||
    ""
  ).toLowerCase();
  const rawSlug = getRawModelSlug(model);
  const { org } = parseModelSlugParts(rawSlug);

  if (org && MODEL_GATEWAY_PROVIDER_IDS.has(gatewayId)) {
    return formatOrgSlug(org);
  }

  return getProviderDisplayName(model.underlyingProviderName || model.provider);
}

/** Model id for display — never "Autodetect" / AUTODETECT. */
export function getModelDisplayId(
  model: Pick<ModelDescription, "model" | "title"> | null | undefined,
): string {
  if (!model) {
    return "";
  }

  const title = (model.title ?? "").trim();
  const rawSlug = getRawModelSlug(model);

  if (title && !isAutodetect(title) && !isSlugLike(title)) {
    return title;
  }

  if (rawSlug) {
    const formatted = formatModelDisplayName(rawSlug);
    if (formatted) {
      return formatted;
    }
  }

  if (title && !isAutodetect(title)) {
    return formatModelDisplayName(title) || title;
  }

  return "models";
}

/**
 * Full label for roles + chat dropdown options: `OpenAI · gpt-4o`.
 * Chat closed button uses getModelDisplayId only (model name, no provider).
 * Never shows bare Autodetect.
 */
export function formatModelLabel(
  model:
    | (Pick<
        ModelDescription,
        "provider" | "underlyingProviderName" | "model" | "title"
      > &
        Partial<ModelDescription>)
    | null
    | undefined,
): string {
  if (!model) {
    return "Select model";
  }
  const providerName = getModelPickerProviderLabel(model);
  const modelId = getModelDisplayId(model);
  if (!modelId || modelId === "models") {
    return providerName;
  }
  return `${providerName} · ${modelId}`;
}
