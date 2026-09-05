import fs from "fs";

import { markdownToRule, MCPServer, ModelConfig, ModelRole } from "agent-config";
import { v4 as uuidv4 } from "uuid";
import {
    AgentConfig,
    ExperimentalModelRoles,
    IDE,
    ILLM,
    JSONModelDescription,
    PromptTemplate,
} from "../";
import { PROMPTS_DIR_NAME, RULES_DIR_NAME } from "../promptFiles";
import {
    GlobalContext,
    StoredGuiPrompt,
    StoredGuiRule,
} from "../util/GlobalContext";
import { quantumSettingsRuleUri } from "./guiUris";
import { getAllDotAgentDefinitionFiles } from "./loadLocalAssistants";

function stringify(obj: any, indentation?: number): string {
  return JSON.stringify(
    obj,
    (key, value) => {
      return value === null ? undefined : value;
    },
    indentation,
  );
}

const DEFAULT_CHAT_MODEL_ROLES: ModelRole[] = [
  "chat",
  "apply",
  "edit",
  "autocomplete",
];

export interface AddModelOptions {
  role?: keyof ExperimentalModelRoles;
  roles?: ModelRole[];
  profileId?: string;
}

function resolveModelRoles(options?: AddModelOptions): ModelRole[] {
  if (options?.roles?.length) {
    return options.roles;
  }
  return DEFAULT_CHAT_MODEL_ROLES;
}

function selectModelForRoles(
  profileId: string | undefined,
  modelTitle: string,
  roles: ModelRole[],
) {
  if (!profileId) {
    return;
  }

  const globalContext = new GlobalContext();
  const currentSelectedModels =
    globalContext.get("selectedModelsByProfileId") ?? {};
  const currentForProfile = { ...(currentSelectedModels[profileId] ?? {}) };

  for (const role of roles) {
    currentForProfile[role] = modelTitle;
  }

  globalContext.update("selectedModelsByProfileId", {
    ...currentSelectedModels,
    [profileId]: currentForProfile,
  });
}

/** Provider-specific fields live under ModelConfig.env (YAML shape). */
const MODEL_ENV_KEYS = [
  "deployment",
  "apiVersion",
  "apiType",
  "deploymentId",
  "projectId",
  "region",
  "profile",
  "accessKeyId",
  "secretAccessKey",
  "modelArn",
  "accountId",
  "useLegacyCompletionsEndpoint",
] as const;

function extractModelEnv(
  model: JSONModelDescription,
): ModelConfig["env"] | undefined {
  const env: NonNullable<ModelConfig["env"]> = {};
  for (const key of MODEL_ENV_KEYS) {
    const value = model[key as keyof JSONModelDescription];
    if (value !== undefined && value !== null && value !== "") {
      env[key] = value as string | boolean | number;
    }
  }
  return Object.keys(env).length > 0 ? env : undefined;
}

function jsonModelToModelConfig(
  model: JSONModelDescription,
  roles: ModelRole[],
): ModelConfig {
  return {
    name: model.title,
    provider: model.provider,
    model: model.model,
    apiKey: model.apiKey,
    apiBase: model.apiBase,
    maxStopWords: model.maxStopWords,
    defaultCompletionOptions: model.completionOptions,
    roles,
    env: extractModelEnv(model),
  };
}

function getGuiModels(): ModelConfig[] {
  return new GlobalContext().get("guiModels") ?? [];
}

function setGuiModels(models: ModelConfig[]) {
  new GlobalContext().update("guiModels", models);
}

function getGuiMcpServers(): MCPServer[] {
  return new GlobalContext().get("guiMcpServers") ?? [];
}

function setGuiMcpServers(servers: MCPServer[]) {
  new GlobalContext().update("guiMcpServers", servers);
}

export function addModel(
  model: JSONModelDescription,
  options?: AddModelOptions,
) {
  const role = options?.role;
  const profileId = options?.profileId;
  const roles = resolveModelRoles(options);

  console.log(
    `[CORE] addModel called: ${model.title}, roles: ${roles.join(",")}, profileId: ${profileId}`,
  );

  const models = getGuiModels();
  if (models.some((m) => stringify(m) === stringify(jsonModelToModelConfig(model, roles)))) {
    return;
  }

  const numMatches = models.reduce(
    (prev, curr) =>
      curr.name.startsWith(model.title) ? prev + 1 : prev,
    0,
  );
  if (numMatches > 0) {
    model.title = `${model.title} (${numMatches})`;
  }

  setGuiModels([...models, jsonModelToModelConfig(model, roles)]);
  selectModelForRoles(profileId, model.title, roles);
}

export function addMcpServer(server: MCPServer) {
  setGuiMcpServers([...getGuiMcpServers(), server]);
}

export function updateModel(
  title: string,
  updates: JSONModelDescription,
) {
  setGuiModels(
    getGuiModels().map((m) => {
      if (m.name !== title) {
        return m;
      }
      const nextEnv = extractModelEnv(updates);
      return {
        ...m,
        provider: updates.provider ?? m.provider,
        model: updates.model ?? m.model,
        apiKey: updates.apiKey ?? m.apiKey,
        apiBase: updates.apiBase ?? m.apiBase,
        maxStopWords: updates.maxStopWords ?? m.maxStopWords,
        defaultCompletionOptions:
          updates.completionOptions ?? m.defaultCompletionOptions,
        env: nextEnv ? { ...(m.env ?? {}), ...nextEnv } : m.env,
      };
    }),
  );
}

export function deleteModel(title: string) {
  setGuiModels(getGuiModels().filter((m) => m.name !== title));

  // Clear role selections that pointed at the removed model.
  const globalContext = new GlobalContext();
  const selectedByProfile =
    globalContext.get("selectedModelsByProfileId") ?? {};
  let changed = false;
  const next: typeof selectedByProfile = {};
  for (const [profileId, roles] of Object.entries(selectedByProfile)) {
    const cleaned = { ...roles };
    for (const role of Object.keys(cleaned) as (keyof typeof cleaned)[]) {
      if (cleaned[role] === title) {
        cleaned[role] = null;
        changed = true;
      }
    }
    next[profileId] = cleaned;
  }
  if (changed) {
    globalContext.update("selectedModelsByProfileId", next);
  }
}

export function updateMcpServer(originalName: string, server: MCPServer) {
  setGuiMcpServers(
    getGuiMcpServers().map((s) => {
      if ("uses" in s) {
        return s;
      }
      return s.name === originalName ? server : s;
    }),
  );
}

export function deleteMcpServer(name: string) {
  setGuiMcpServers(getGuiMcpServers().filter((s) => s.name !== name));
}

export {
    parseQuantumSettingsPromptId,
    parseQuantumSettingsRuleId, QUANTUM_SETTINGS_SCHEME, quantumSettingsMcpUri,
    quantumSettingsPromptUri,
    quantumSettingsRuleUri
} from "./guiUris";

export function getGuiRules(): StoredGuiRule[] {
  return new GlobalContext().get("guiRules") ?? [];
}

function setGuiRules(rules: StoredGuiRule[]) {
  new GlobalContext().update("guiRules", rules);
}

function getGuiPrompts(): StoredGuiPrompt[] {
  return new GlobalContext().get("guiPrompts") ?? [];
}

function setGuiPrompts(prompts: StoredGuiPrompt[]) {
  new GlobalContext().update("guiPrompts", prompts);
}

export function addGuiRule(options: {
  name: string;
  rule: string;
  description?: string;
  globs?: string | string[];
  regex?: string | string[];
  alwaysApply?: boolean;
  invokable?: boolean;
}): string {
  const id = uuidv4();
  const stored: StoredGuiRule = { id, ...options };
  setGuiRules([...getGuiRules(), stored]);
  return id;
}

export function updateGuiRule(
  ruleId: string,
  updates: Partial<Omit<StoredGuiRule, "id">>,
) {
  setGuiRules(
    getGuiRules().map((rule) =>
      rule.id === ruleId ? { ...rule, ...updates } : rule,
    ),
  );
}

export function deleteGuiRule(ruleId: string) {
  setGuiRules(getGuiRules().filter((rule) => rule.id !== ruleId));
}

export function addGuiPrompt(options: {
  name: string;
  prompt: string;
  description?: string;
  invokable?: boolean;
}): string {
  const id = uuidv4();
  const stored: StoredGuiPrompt = {
    id,
    invokable: true,
    ...options,
  };
  setGuiPrompts([...getGuiPrompts(), stored]);
  return id;
}

export function updateGuiPrompt(
  promptId: string,
  updates: Partial<Omit<StoredGuiPrompt, "id">>,
) {
  setGuiPrompts(
    getGuiPrompts().map((prompt) =>
      prompt.id === promptId ? { ...prompt, ...updates } : prompt,
    ),
  );
}

export function deleteGuiPrompt(promptId: string) {
  setGuiPrompts(getGuiPrompts().filter((prompt) => prompt.id !== promptId));
}

export async function migrateLegacyGuiConfigIfNeeded(ide: IDE): Promise<void> {
  const globalContext = new GlobalContext();
  const existingRules = globalContext.get("guiRules") ?? [];
  const existingPrompts = globalContext.get("guiPrompts") ?? [];

  if (existingRules.length > 0 && existingPrompts.length > 0) {
    return;
  }

  const migratedRules: StoredGuiRule[] = [...existingRules];
  const migratedPrompts: StoredGuiPrompt[] = [...existingPrompts];
  const filesToDelete: string[] = [];

  const dirsToCheck: Array<{ dir: string; target: "rules" | "prompts" }> = [
    { dir: RULES_DIR_NAME, target: "rules" },
    { dir: PROMPTS_DIR_NAME, target: "prompts" },
  ];

  for (const { dir, target } of dirsToCheck) {
    if (target === "rules" && existingRules.length > 0) {
      continue;
    }
    if (target === "prompts" && existingPrompts.length > 0) {
      continue;
    }

    try {
      const markdownFiles = await getAllDotAgentDefinitionFiles(
        ide,
        { includeGlobal: true, includeWorkspace: true },
        dir,
      );
      const mdFiles = markdownFiles.filter((file) => file.path.endsWith(".md"));

      for (const file of mdFiles) {
        try {
          const parsed = markdownToRule(file.content, {
            uriType: "file",
            fileUri: file.path,
          });

          if (target === "prompts" && parsed.invokable) {
            migratedPrompts.push({
              id: uuidv4(),
              name: parsed.name ?? "prompt",
              prompt: parsed.rule,
              description: parsed.description,
              invokable: true,
            });
            filesToDelete.push(file.path);
          } else if (target === "rules" && !parsed.invokable) {
            migratedRules.push({
              id: uuidv4(),
              name: parsed.name ?? "rule",
              rule: parsed.rule,
              description: parsed.description,
              globs: parsed.globs,
              regex: parsed.regex,
              alwaysApply: parsed.alwaysApply,
              invokable: parsed.invokable,
            });
            filesToDelete.push(file.path);
          }
        } catch {
          // Skip unreadable legacy files
        }
      }
    } catch {
      // Skip missing legacy directories
    }
  }

  const rulesUpdated = migratedRules.length !== existingRules.length;
  const promptsUpdated = migratedPrompts.length !== existingPrompts.length;

  if (rulesUpdated) {
    globalContext.update("guiRules", migratedRules);
  }
  if (promptsUpdated) {
    globalContext.update("guiPrompts", migratedPrompts);
  }

  if ((rulesUpdated || promptsUpdated) && filesToDelete.length > 0) {
    await Promise.all(
      filesToDelete.map(async (fileUri) => {
        try {
          await ide.removeFile(fileUri);
        } catch {
          // Best-effort cleanup of migrated legacy files
        }
      }),
    );
  }
}

export function getModelByRole<T extends keyof ExperimentalModelRoles>(
  config: AgentConfig,
  role: T,
): ILLM | undefined {
  const roleTitle = config.experimental?.modelRoles?.[role];

  if (!roleTitle) {
    return undefined;
  }

  const matchingModel = config.modelsByRole.chat.find(
    (model) => model.title === roleTitle,
  );

  return matchingModel;
}

export function serializePromptTemplates(
  templates: Record<string, PromptTemplate> | undefined,
): Record<string, string> | undefined {
  if (!templates) return undefined;

  return Object.fromEntries(
    Object.entries(templates).map(([key, template]) => {
      const serialized = typeof template === "function" ? "" : template;
      return [key, serialized];
    }),
  );
}
