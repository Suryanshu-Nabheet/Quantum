import {
  MCPServer,
  mergeRequestOptions,
  RequestOptions,
  Rule,
} from "agent-config";
import {
  InternalMcpOptions,
  InternalSseMcpOptions,
  InternalStdioMcpOptions,
  InternalStreamableHttpMcpOptions,
  RuleWithSource,
} from "../..";

export function convertBlockRuleToAgentRule(rule: Rule): RuleWithSource {
  if (typeof rule === "string") {
    return {
      rule: rule,
      source: "quantum-settings",
    };
  } else {
    return {
      source: rule.sourceFile?.startsWith("quantum-settings://")
        ? "quantum-settings"
        : "rules-block",
      rule: rule.rule,
      globs: rule.globs,
      regex: rule.regex,
      name: rule.name,
      description: rule.description,
      sourceFile: rule.sourceFile,
      alwaysApply: rule.alwaysApply,
      invokable: rule.invokable ?? false,
    };
  }
}

export function convertMcpConfigToInternalMcpOptions(
  config: MCPServer,
  globalRequestOptions?: RequestOptions,
): InternalMcpOptions {
  const { connectionTimeout, faviconUrl, name, sourceFile } = config;
  const shared = {
    id: name,
    name,
    faviconUrl: faviconUrl,
    timeout: connectionTimeout,
    sourceFile,
  };
  // Stdio
  if ("command" in config) {
    const { args, command, cwd, env, type } = config;
    const stdioOptions: InternalStdioMcpOptions = {
      ...shared,
      type,
      command,
      args,
      cwd,
      env,
    };
    return stdioOptions;
  }
  // HTTP/SSE
  const { type, url, apiKey, requestOptions } = config;
  const httpSseConfig:
    | InternalStreamableHttpMcpOptions
    | InternalSseMcpOptions = {
    ...shared,
    type,
    url,
    apiKey,
    requestOptions: mergeRequestOptions(
      requestOptions,
      globalRequestOptions,
    ),
  };
  return httpSseConfig;
}
