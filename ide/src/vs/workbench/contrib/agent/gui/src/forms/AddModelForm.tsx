import { ModelRole } from "agent-config";
import { ModelDescription } from "core";
import { quantumSettingsPath } from "core/util/branding";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FormProvider, useForm } from "react-hook-form";
import { Button, Input, StyledActionButton } from "../components";
import Alert from "../components/gui/Alert";
import ModelSelectionListbox from "../components/modelSelection/ModelSelectionListbox";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { completionParamsInputs } from "../pages/AddNewModel/configs/completionParamsInputs";
import { DisplayInfo, ModelPackage } from "../pages/AddNewModel/configs/models";
import {
  initializeOpenRouterModels,
  ProviderInfo,
  providers,
} from "../pages/AddNewModel/configs/providers";
import { CONFIG_ROUTES } from "../util/navigation";

interface AddModelFormProps {
  onDone: () => void;
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

function findPackageForModel(
  provider: ProviderInfo,
  model: ModelDescription,
): ModelPackage | undefined {
  return provider.packages.find(
    (pkg) =>
      pkg.title === model.title ||
      pkg.params.model === model.model ||
      model.model.startsWith(pkg.params.model),
  );
}

const DEFAULT_MODEL_ROLES: ModelRole[] = [
  "chat",
  "apply",
  "edit",
  "autocomplete",
];

const CODESTRAL_URL = "https://console.mistral.ai/codestral";

export function AddModelForm({
  onDone,
  roles = DEFAULT_MODEL_ROLES,
  formTitle = "Add model",
  existingModel,
}: AddModelFormProps) {
  const isEditing = !!existingModel;
  const initialProvider =
    (existingModel && findProviderForModel(existingModel)) ??
    providers["openai"]!;
  const initialPackage =
    (existingModel && findPackageForModel(initialProvider, existingModel)) ??
    initialProvider.packages[0];

  const [selectedProvider, setSelectedProvider] =
    useState<ProviderInfo>(initialProvider);
  const [selectedModel, setSelectedModel] = useState(initialPackage);
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
        }
      : {},
  });
  const ideMessenger = useContext(IdeMessengerContext);
  const navigate = useNavigate();

  useEffect(() => {
    void initializeOpenRouterModels();
  }, []);

  // Prefill all known fields when configuring an existing model.
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
    .map((provider) => provider!);

  const popularProviders = allProviders
    .filter((provider) => popularProviderTitles.includes(provider.title))
    .sort((a, b) => a.title.localeCompare(b.title));

  const otherProviders = allProviders
    .filter((provider) => !popularProviderTitles.includes(provider.title))
    .sort((a, b) => a.title.localeCompare(b.title));

  const selectedProviderApiKeyUrl =
    selectedModel && selectedModel.params.model.startsWith("codestral")
      ? CODESTRAL_URL
      : selectedProvider.apiKeyUrl;

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
      // Editing: leave blank to keep the stored value (especially API keys).
      if (isEditing && existingValueFor(input.key)) {
        return true;
      }
      return false;
    });
  }

  useEffect(() => {
    if (existingModel) {
      const pkg = findPackageForModel(selectedProvider, existingModel);
      setSelectedModel(pkg ?? selectedProvider.packages[0]);
      return;
    }
    setSelectedModel(selectedProvider.packages[0]);
  }, [selectedProvider, existingModel]);

  async function onSubmit() {
    const reqInputFields: Record<string, string> = {};
    for (const input of selectedProvider.collectInputFor ?? []) {
      const watched = formMethods.watch(input.key);
      if (watched !== undefined && watched !== "") {
        reqInputFields[input.key] = watched;
      } else if (isEditing) {
        const existing = existingValueFor(input.key);
        // Don't re-send apiKeyLocation as apiKey — only real key values.
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
      ...selectedModel.params,
      ...reqInputFields,
      provider: selectedProvider.provider,
      title: isEditing ? existingModel!.title : selectedModel.title,
      ...(hasValidApiKey ? { apiKey } : {}),
    };

    if (existingModel) {
      await ideMessenger.request("config/updateModel", {
        title: existingModel.title,
        model: {
          ...model,
          title: existingModel.title,
        },
      });
    } else {
      await ideMessenger.request("config/addModel", { model, roles });
    }

    onDone();
  }

  function onClickDownloadProvider() {
    selectedProvider.downloadUrl &&
      ideMessenger.post("openUrl", selectedProvider.downloadUrl);
  }

  const extraFields = (selectedProvider.collectInputFor ?? []).filter(
    (field) =>
      !Object.values(completionParamsInputs).some(
        (input) => input.key === field.key,
      ) &&
      field.key !== "apiKey" &&
      (field.required || isEditing || field.key === "apiBase"),
  );

  return (
    <FormProvider {...formMethods}>
      <form onSubmit={formMethods.handleSubmit(onSubmit)}>
        <div className="mx-auto max-w-md p-6">
          <h1 className="mb-0 text-center text-2xl">{formTitle}</h1>

          <div className="my-8 flex flex-col gap-6">
            <div>
              <label className="block text-sm font-medium">Provider</label>
              <ModelSelectionListbox
                selectedProvider={selectedProvider}
                setSelectedProvider={(val: DisplayInfo) => {
                  const match = [...popularProviders, ...otherProviders].find(
                    (provider) => provider.title === val.title,
                  );
                  if (match) {
                    setSelectedProvider(match);
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

            <div>
              <label className="block text-sm font-medium">Model</label>
              <ModelSelectionListbox
                selectedProvider={selectedModel}
                setSelectedProvider={(val: DisplayInfo) => {
                  const options =
                    Object.entries(providers).find(
                      ([, provider]) =>
                        provider?.title === selectedProvider.title,
                    )?.[1]?.packages ?? [];
                  const match = options.find(
                    (option) => option.title === val.title,
                  );
                  if (match) {
                    setSelectedModel(match);
                  }
                }}
                topOptions={
                  Object.entries(providers).find(
                    ([, provider]) =>
                      provider?.title === selectedProvider.title,
                  )?.[1]?.packages
                }
              />
            </div>

            {selectedModel.params.model.startsWith("codestral") && (
              <div className="my-2">
                <Alert>
                  <p className="m-0 text-sm font-bold">Codestral API key</p>
                  <p className="m-0 mt-1">
                    Note that codestral requires a different API key from other
                    Mistral models
                  </p>
                </Alert>
              </div>
            )}

            {(selectedProvider.apiKeyUrl ||
              selectedProvider.collectInputFor?.some(
                (f) => f.key === "apiKey",
              )) && (
              <div>
                <label className="mb-1 block text-sm font-medium">
                  API key
                </label>
                <Input
                  id="apiKey"
                  className="w-full"
                  type="password"
                  placeholder={
                    isEditing && (existingModel?.apiKey || existingModel?.apiKeyLocation)
                      ? "Leave blank to keep current key"
                      : `Enter your ${selectedProvider.title} API key`
                  }
                  autoComplete="off"
                  {...formMethods.register("apiKey")}
                />
                {selectedProviderApiKeyUrl && (
                  <span className="text-description-muted mt-1 block text-xs">
                    <a
                      className="cursor-pointer text-inherit underline hover:text-inherit hover:brightness-125"
                      onClick={() => {
                        ideMessenger.post(
                          "openUrl",
                          selectedProviderApiKeyUrl,
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

          <div className="mt-4 w-full">
            <Button type="submit" className="w-full" disabled={isDisabled()}>
              {existingModel ? "Save changes" : "Connect"}
            </Button>

            <span className="text-description-muted block w-full text-center text-xs">
              Model is saved in{" "}
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
