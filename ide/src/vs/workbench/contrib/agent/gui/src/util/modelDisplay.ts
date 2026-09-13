import { ModelDescription } from "core";
import { providers } from "../pages/AddNewModel/configs/providers";

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
  // Fallback: capitalize provider id
  return id.charAt(0).toUpperCase() + id.slice(1);
}

/** Model id for display — never "Autodetect" / AUTODETECT. */
export function getModelDisplayId(
  model: Pick<ModelDescription, "model" | "title"> | null | undefined,
): string {
  if (!model) {
    return "";
  }
  const raw = (model.model ?? "").trim();
  if (raw && raw.toUpperCase() !== "AUTODETECT") {
    return raw;
  }
  const title = (model.title ?? "").trim();
  if (
    title &&
    title.toLowerCase() !== "autodetect" &&
    title.toUpperCase() !== "AUTODETECT"
  ) {
    return title;
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
  const providerName = getProviderDisplayName(
    model.underlyingProviderName || model.provider,
  );
  const modelId = getModelDisplayId(model);
  if (!modelId || modelId === "models") {
    return providerName;
  }
  return `${providerName} · ${modelId}`;
}
