import { ModelDescription } from "core";
import { getProviderDisplayName } from "../../util/modelDisplay";

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

export interface ConfiguredProviderGroup {
  providerId: string;
  displayName: string;
  models: ModelDescription[];
  /** Representative model for configure (prefers one with an API key). */
  credentialModel: ModelDescription;
}

/** Group expanded models into provider cards for the Models page. */
export function groupModelsByProvider(
  models: ModelDescription[],
): ConfiguredProviderGroup[] {
  const byProvider = new Map<string, ModelDescription[]>();
  for (const model of models) {
    const id = (model.underlyingProviderName || model.provider || "unknown")
      .trim()
      .toLowerCase();
    const list = byProvider.get(id) ?? [];
    list.push(model);
    byProvider.set(id, list);
  }

  return Array.from(byProvider.entries())
    .map(([providerId, groupModels]) => {
      const credentialModel =
        groupModels.find((m) => !!m.apiKey || !!m.apiKeyLocation) ??
        groupModels[0];
      return {
        providerId,
        displayName: getProviderDisplayName(
          credentialModel.underlyingProviderName || credentialModel.provider,
        ),
        models: groupModels,
        credentialModel,
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}
