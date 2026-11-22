import { ModelRole } from "agent-config";
import { ModelDescription } from "core";
import { quantumSettingsPath } from "core/util/branding";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FormProvider, useForm } from "react-hook-form";
import { Button, Input, StyledActionButton } from "../components";
import ModelSelectionListbox from "../components/modelSelection/ModelSelectionListbox";
import { HostBridgeContext } from "../context/HostBridge";
import { completionParamsInputs } from "../pages/AddNewModel/configs/completionParamsInputs";
import { DisplayInfo, models } from "../pages/AddNewModel/configs/models";
import {
  initializeOpenRouterModels,
  ProviderInfo,
  providers,
} from "../pages/AddNewModel/configs/providers";
import { CONFIG_ROUTES } from "../util/navigation";
import {
  CUSTOM_OPENAI_PROVIDER_ID_PREFIX,
  customOpenAIProviderId,
  isCustomOpenAIProviderId,
  normalizeCustomOpenAIApiBase,
} from "../util/customProvider";

const CUSTOM_PROVIDER_TITLE = "Custom provider";

const customProvider: ProviderInfo = {
  title: CUSTOM_PROVIDER_TITLE,
  provider: `${CUSTOM_OPENAI_PROVIDER_ID_PREFIX}pending`,
  description: "Connect an OpenAI-compatible API endpoint",
  packages: [],
  collectInputFor: [
    {
      inputType: "text",
      key: "providerName",
      label: "Provider name",
      placeholder: "e.g. My local server",
      required: true,
    },
    {
      inputType: "text",
      key: "apiBase",
      label: "API base URL",
      placeholder: "e.g. http://localhost:1234/v1",
      required: true,
    },
    {
      inputType: "password",
      key: "apiKey",
      label: "API key",
      placeholder: "Leave blank if your server does not require a key",
    },
    {
      inputType: "text",
      key: "model",
      label: "Model ID",
      placeholder: "e.g. qwen2.5-coder-14b-instruct",
      required: true,
    },
    {
      inputType: "number",
      key: "contextLength",
      label: "Context window (tokens)",
      placeholder: "e.g. 1000000",
      required: false,
    },
  ],
};

export interface AddModelFormProps {
  onDone: (addedModel?: ModelDescription) => void;
  roles?: ModelRole[];
  formTitle?: string;
  existingModel?: ModelDescription;
}

function findProviderForModel(model: ModelDescription): ProviderInfo | undefined {
  return Object.values(providers).find(
    (provider) =>
      provider?.provider === model.provider ||
      provider?.provider === model.underlyingProviderName,
  );
}

const DEFAULT_MODEL_ROLES: ModelRole[] = [
  "chat",
  "apply",
  "edit",
  "autocomplete",
];

export function AddModelForm({
  onDone,
  roles = DEFAULT_MODEL_ROLES,
  formTitle = "Add provider",
  existingModel,
}: AddModelFormProps) {
  const isEditing = !!existingModel;
  const existingIsCustomProvider =
    !!existingModel && isCustomOpenAIProviderId(existingModel.provider);
  const initialProvider =
    (existingModel && findProviderForModel(existingModel)) ??
    (existingIsCustomProvider ? customProvider : providers["openai"]!);

  const [selectedProvider, setSelectedProvider] =
    useState<ProviderInfo>(initialProvider);
  const formMethods = useForm<Record<string, string>>({
    defaultValues: existingModel
      ? {
          apiKey: existingModel.apiKey ?? "",
          apiBase: existingModel.apiBase ?? "",
          deployment: existingModel.deployment ?? "",
          apiVersion: existingModel.apiVersion ?? "",
          apiType: existingModel.apiType ?? "",
          deploymentId: existingModel.deploymentId ?? "",
          projectId: existingModel.projectId ?? "",
          region: existingModel.region ?? "",
          profile: existingModel.profile ?? "",
          accountId: existingModel.accountId ?? "",
          providerName: existingIsCustomProvider
            ? existingModel.title.split(" / ")[0]
            : "",
          model: existingIsCustomProvider ? existingModel.model : "",
          contextLength: existingModel?.contextLength
            ? String(existingModel.contextLength)
            : "",
        }
      : {},
  });
  const hostBridge = useContext(HostBridgeContext);
  const navigate = useNavigate();

  useEffect(() => {
    void initializeOpenRouterModels();
  }, []);

  useEffect(() => {
    if (!existingModel) {
      return;
    }
    const defaults: Record<string, string> = {
      apiKey: existingModel.apiKey ?? "",
      apiBase: existingModel.apiBase ?? "",
      deployment: existingModel.deployment ?? "",
      apiVersion: existingModel.apiVersion ?? "",
      apiType: existingModel.apiType ?? "",
      deploymentId: existingModel.deploymentId ?? "",
      projectId: existingModel.projectId ?? "",
      region: existingModel.region ?? "",
      profile: existingModel.profile ?? "",
      accountId: existingModel.accountId ?? "",
      providerName: existingIsCustomProvider
        ? existingModel.title.split(" / ")[0]
        : "",
      model: existingIsCustomProvider ? existingModel.model : "",
      contextLength: existingModel.contextLength
        ? String(existingModel.contextLength)
        : "",
    };
    for (const input of selectedProvider.collectInputFor ?? []) {
      if (defaults[input.key] !== undefined && defaults[input.key] !== "") {
        continue;
      }
      if (input.defaultValue !== undefined) {
        defaults[input.key] = String(input.defaultValue);
      }
    }
    formMethods.reset(defaults);
  }, [existingModel, selectedProvider, formMethods]);

  const popularProviderTitles = [
    providers["openai"]?.title || "",
    providers["anthropic"]?.title || "",
    providers["mistral"]?.title || "",
    providers["gemini"]?.title || "",
    providers["azure"]?.title || "",
    providers["ollama"]?.title || "",
    providers["openrouter"]?.title || "",
  ];

  const allProviders = Object.entries(providers)
    .filter(([key]) => !["openai-aiohttp"].includes(key))
    .map(([, provider]) => provider)
    .filter((provider) => !!provider)
    .map((provider) => provider!)
    .concat(customProvider);

  const popularProviders = allProviders
    .filter((provider) => popularProviderTitles.includes(provider.title))
    .sort((a, b) => a.title.localeCompare(b.title));

  const otherProviders = allProviders
    .filter((provider) => !popularProviderTitles.includes(provider.title))
    .filter((provider) => provider.title !== CUSTOM_PROVIDER_TITLE)
    .sort((a, b) => a.title.localeCompare(b.title))
    .concat(customProvider);

  function existingValueFor(key: string): string | undefined {
    if (!existingModel) {
      return undefined;
    }
    const fromModel: Record<string, string | undefined> = {
      apiKey: existingModel.apiKey,
      apiBase: existingModel.apiBase,
      deployment: existingModel.deployment,
      apiVersion: existingModel.apiVersion,
      apiType: existingModel.apiType,
      deploymentId: existingModel.deploymentId,
      projectId: existingModel.projectId,
      region: existingModel.region,
      profile: existingModel.profile,
      accountId: existingModel.accountId,
    };
    const value = fromModel[key];
    if (value && value.length > 0) {
      return value;
    }
    if (key === "apiKey" && existingModel.apiKeyLocation) {
      return existingModel.apiKeyLocation;
    }
    return undefined;
  }

  function isDisabled() {
    if (selectedProvider.downloadUrl) {
      return false;
    }

    const requiredInputs =
      selectedProvider.collectInputFor?.filter((input) => input.required) ?? [];

    return !requiredInputs.every((input) => {
      const value = formMethods.watch(input.key);
      if (value !== undefined && value.length > 0) {
        return true;
      }
      if (isEditing && (existingValueFor(input.key) ||
        (input.key === "apiKey" && existingModel?.hasApiKey))) {
        return true;
      }
      return false;
    });
  }

  async function onSubmit() {
    const isCustomProvider =
      selectedProvider === customProvider ||
      isCustomOpenAIProviderId(selectedProvider.provider);
    if (isCustomProvider) {
      formMethods.clearErrors("root");
      try {
        const providerName = (
          formMethods.getValues("providerName") ?? ""
        ).trim();
        const modelId = (formMethods.getValues("model") ?? "").trim();
        const apiBase = normalizeCustomOpenAIApiBase(
          formMethods.getValues("apiBase") ?? "",
        );
        if (!providerName || !modelId) {
          throw new Error("Enter a provider name and model ID.");
        }
        const provider = customOpenAIProviderId(providerName, apiBase);
        const apiKey = formMethods.getValues("apiKey")?.trim();
        const configuredContextLength = Number.parseInt(
          formMethods.getValues("contextLength") ?? "",
          10,
        );
        const model = {
          provider,
          underlyingProviderName: provider,
          title: `${providerName} / ${modelId}`,
          model: modelId,
          apiBase,
          ...(Number.isSafeInteger(configuredContextLength) &&
          configuredContextLength > 0
            ? { contextLength: configuredContextLength }
            : {}),
          ...(apiKey ? { apiKey } : {}),
        };
        const response = existingModel
          ? await hostBridge.request("config/updateModel", {
              title: existingModel.title,
              model,
            })
          : await hostBridge.request("config/addModel", { model, roles });
        if (response.status === "error") {
          throw new Error(response.error);
        }
        onDone(existingModel ? undefined : (model as ModelDescription));
        return;
      } catch (error) {
        formMethods.setError("root", {
          type: "server",
          message:
            error instanceof Error ? error.message : "Failed to save provider.",
        });
        return;
      }
    }

    const reqInputFields: Record<string, string> = {};
    for (const input of selectedProvider.collectInputFor ?? []) {
      const watched = formMethods.watch(input.key);
      if (watched !== undefined && watched !== "") {
        reqInputFields[input.key] = watched;
      } else if (isEditing) {
        const existing = existingValueFor(input.key);
        if (input.key === "apiKey") {
          if (existingModel?.apiKey) {
            // omit — updateModel keeps previous via ??
          }
        } else if (existing) {
          reqInputFields[input.key] = existing;
        }
      }
    }

    const apiKey = reqInputFields.apiKey;
    const hasValidApiKey = apiKey !== undefined && apiKey !== "";

    const model = {
      ...selectedProvider.params,
      ...models.AUTODETECT.params,
      ...reqInputFields,
      provider: selectedProvider.provider,
      title: selectedProvider.title,
      ...(hasValidApiKey ? { apiKey } : {}),
    };

    formMethods.clearErrors("root");
    try {
      const response = existingModel
        ? await hostBridge.request("config/updateModel", {
            title: existingModel.title,
            model: {
              ...model,
              // Prefer updating the provider credential row by provider id.
              title: selectedProvider.title,
              model: "AUTODETECT",
            },
          })
        : await hostBridge.request("config/addModel", { model, roles });

      if (response.status === "error") {
        throw new Error(response.error);
      }

      onDone(existingModel ? undefined : (model as ModelDescription));
    } catch (error) {
      formMethods.setError("root", {
        type: "server",
        message:
          error instanceof Error ? error.message : "Failed to save provider.",
      });
    }
  }

  function onClickDownloadProvider() {
    selectedProvider.downloadUrl &&
      hostBridge.post("openUrl", selectedProvider.downloadUrl);
  }

  const extraFields = (selectedProvider.collectInputFor ?? []).filter(
    (field) =>
      (selectedProvider === customProvider ||
        !Object.values(completionParamsInputs).some(
        (input) => input.key === field.key,
      )) &&
      field.key !== "apiKey" &&
      (field.required ||
        isEditing ||
        field.key === "apiBase" ||
        (selectedProvider === customProvider && field.key === "contextLength")),
  );

  const needsApiKey =
    !!selectedProvider.apiKeyUrl ||
    selectedProvider.collectInputFor?.some((f) => f.key === "apiKey");

  return (
    <FormProvider {...formMethods}>
      <form onSubmit={formMethods.handleSubmit(onSubmit)}>
        <div className="box-border mx-auto w-full min-w-0 max-w-md p-4 sm:p-6">
          <h1 className="mb-0 text-center text-2xl">{formTitle}</h1>
          <p className="text-description mt-2 mb-0 text-center text-sm">
            Connect a provider once to use all of its available models in Model
            roles and chat.
          </p>

          <div className="my-8 flex flex-col gap-6">
            <div className="min-w-0">
              <label className="mb-1 block text-sm font-medium">Provider</label>
              <ModelSelectionListbox
                selectedProvider={selectedProvider}
                setSelectedProvider={(val: DisplayInfo) => {
                  if (isEditing) {
                    return;
                  }
                  const match = [...popularProviders, ...otherProviders].find(
                    (provider) => provider.title === val.title,
                  );
                  if (match) {
                    setSelectedProvider(
                      match.title === CUSTOM_PROVIDER_TITLE
                        ? customProvider
                        : match,
                    );
                  }
                }}
                topOptions={popularProviders}
                otherOptions={otherProviders}
                searchPlaceholder="Search providers..."
              />
            </div>

            {selectedProvider.downloadUrl && (
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Install provider
                </label>
                <StyledActionButton onClick={onClickDownloadProvider}>
                  <p className="text-sm underline">
                    {selectedProvider.downloadUrl}
                  </p>
                  <ArrowTopRightOnSquareIcon width={24} height={24} />
                </StyledActionButton>
              </div>
            )}

            {needsApiKey && (
              <div>
                <label className="mb-1 block text-sm font-medium">
                  API key
                </label>
                <Input
                  id="apiKey"
                  className="w-full"
                  type="password"
                  placeholder={
                    isEditing &&
                    (existingModel?.hasApiKey || existingModel?.apiKeyLocation)
                      ? "Leave blank to keep current key"
                      : `Enter your ${selectedProvider.title} API key`
                  }
                  autoComplete="off"
                  {...formMethods.register("apiKey")}
                />
                {selectedProvider.apiKeyUrl && (
                  <span className="text-description-muted mt-1 block text-xs">
                    <a
                      className="cursor-pointer text-inherit underline hover:text-inherit hover:brightness-125"
                      onClick={() => {
                        hostBridge.post(
                          "openUrl",
                          selectedProvider.apiKeyUrl!,
                        );
                      }}
                    >
                      Click here
                    </a>{" "}
                    to create an API key for {selectedProvider.title}
                  </span>
                )}
              </div>
            )}

            {extraFields.map((field) => (
              <div key={field.key}>
                <label className="mb-1 block text-sm font-medium">
                  {field.label}
                  {!field.required && (
                    <span className="text-description-muted font-normal">
                      {" "}
                      (optional)
                    </span>
                  )}
                </label>
                <Input
                  id={field.key}
                  className="w-full"
                  type={field.inputType === "number" ? "number" : "text"}
                  min={field.inputType === "number" ? 1 : undefined}
                  step={field.inputType === "number" ? 1 : undefined}
                  placeholder={`${field.placeholder ?? ""}`}
                  {...formMethods.register(field.key)}
                />
              </div>
            ))}

            {isEditing &&
              !extraFields.some((f) => f.key === "apiBase") && (
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    API base
                    <span className="text-description-muted font-normal">
                      {" "}
                      (optional)
                    </span>
                  </label>
                  <Input
                    id="apiBase"
                    className="w-full"
                    placeholder="e.g. https://api.anthropic.com"
                    {...formMethods.register("apiBase")}
                  />
                </div>
              )}
          </div>

          {formMethods.formState.errors.root?.message && (
            <p className="text-error mt-2 text-sm" role="alert">
              {formMethods.formState.errors.root.message}
            </p>
          )}

          <div className="mt-4 w-full">
            <Button
              type="submit"
              className="w-full"
              disabled={isDisabled() || formMethods.formState.isSubmitting}
            >
              {formMethods.formState.isSubmitting
                ? "Saving..."
                : existingModel
                  ? "Save changes"
                  : "Connect"}
            </Button>

            <span className="text-description-muted block w-full text-center text-xs">
              Provider is saved in{" "}
              <span
                className="cursor-pointer underline hover:brightness-125"
                onClick={() => navigate(CONFIG_ROUTES.MODELS)}
              >
                {quantumSettingsPath("Models")}
              </span>
            </span>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}

export default AddModelForm;
