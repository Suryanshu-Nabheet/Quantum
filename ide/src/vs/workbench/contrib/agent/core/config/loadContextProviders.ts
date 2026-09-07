import {
  ResolvedAgentSettings,
  ConfigValidationError,
} from "agent-config";
import { IContextProvider, IdeType } from "..";
import { contextProviderClassFromName, Providers } from "../context/providers";
import MCPContextProvider from "../context/providers/MCPContextProvider";

/*
    Loads context providers based on configuration
    - default providers will always be loaded, using config params if present
    - other providers will be loaded if configured

    MCPContextProvider is added in doLoadConfig when MCP resources are present.
*/
export function loadConfigContextProviders(
  configContext: ResolvedAgentSettings["context"],
  ideType: IdeType,
): {
  providers: IContextProvider[];
  errors: ConfigValidationError[];
} {
  const providers: IContextProvider[] = [];
  const errors: ConfigValidationError[] = [];

  type ContextProviderClass = new (options: {
    [key: string]: unknown;
  }) => IContextProvider;

  const defaultProviders: IContextProvider[] = Providers.filter(
    (cls) => cls !== MCPContextProvider,
  ).map((cls) => new (cls as unknown as ContextProviderClass)({}));

  // Add from config
  if (configContext) {
    for (const config of configContext) {
      const cls = contextProviderClassFromName(config.provider) as any;
      if (
        !cls &&
        !defaultProviders.find((p) => p.description.title === config.provider)
      ) {
        errors.push({
          fatal: false,
          message: `Unknown context provider ${config.provider}`,
        });
        continue;
      }
      if (cls) {
        providers.push(
          new cls({
            name: config.name,
            ...config.params,
          }),
        );
      }
    }
  }

  // Add from defaults if not found in config
  for (const defaultProvider of defaultProviders) {
    if (
      !providers.find(
        (p) => p.description.title === defaultProvider.description.title,
      )
    ) {
      providers.push(defaultProvider);
    }
  }

  return {
    providers,
    errors,
  };
}
