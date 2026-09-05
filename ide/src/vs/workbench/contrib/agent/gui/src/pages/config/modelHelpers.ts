import { ModelDescription } from "core";

/** Deduplicate models that appear under multiple roles. */
export function uniqueModelsByTitle(
  modelsByRole: Record<string, ModelDescription[] | undefined>,
): ModelDescription[] {
  const byTitle = new Map<string, ModelDescription>();
  for (const models of Object.values(modelsByRole)) {
    for (const model of models ?? []) {
      if (!byTitle.has(model.title)) {
        byTitle.set(model.title, model);
      }
    }
  }
  return Array.from(byTitle.values()).sort((a, b) =>
    a.title.localeCompare(b.title),
  );
}
