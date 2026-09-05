import * as z from "zod";
import { dataSchema } from "./data/index.js";
import { mcpServerSchema } from "./mcp/index.js";
import {
  modelSchema,
  requestOptionsSchema,
} from "./models.js";

export const contextSchema = z.object({
  name: z.string().optional(),
  provider: z.string(),
  params: z.any().optional(),
});

export type { MCPServer } from "./mcp/index.js";

const promptSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  prompt: z.string(),
  sourceFile: z.string().optional(),
});

export type Prompt = z.infer<typeof promptSchema>;

const docSchema = z.object({
  name: z.string(),
  startUrl: z.string(),
  rootUrl: z.string().optional(),
  faviconUrl: z.string().optional(),
  useLocalCrawling: z.boolean().optional(),
  sourceFile: z.string().optional(),
});

export type DocsConfig = z.infer<typeof docSchema>;

const ruleObjectSchema = z.object({
  name: z.string(),
  rule: z.string(),
  description: z.string().optional(),
  globs: z.union([z.string(), z.array(z.string())]).optional(),
  regex: z.union([z.string(), z.array(z.string())]).optional(),
  alwaysApply: z.boolean().optional(),
  invokable: z.boolean().optional(),
  sourceFile: z.string().optional(),
});
const ruleSchema = z.union([z.string(), ruleObjectSchema]);

export type Rule = z.infer<typeof ruleSchema>;
export type RuleObject = z.infer<typeof ruleObjectSchema>;

export const commonMetadataSchema = z.object({
  tags: z.string().optional(),
  sourceCodeUrl: z.string().optional(),
  description: z.string().optional(),
  author: z.string().optional(),
  license: z.string().optional(),
  iconUrl: z.string().optional(),
});

const envRecord = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean()]),
);

export const agentSettingsBaseSchema = z.object({
  name: z.string(),
  version: z.string(),
  schema: z.string().optional(),
  metadata: z.record(z.string()).and(commonMetadataSchema.partial()).optional(),
  env: envRecord.optional(),
  requestOptions: requestOptionsSchema.optional(),
});

/** In-memory agent settings snapshot (Quantum Settings / globalContext.json). */
export const agentSettingsSchema = agentSettingsBaseSchema.extend({
  models: z.array(modelSchema.nullable()).optional(),
  context: z.array(contextSchema.nullable()).optional(),
  data: z.array(dataSchema.nullable()).optional(),
  mcpServers: z.array(mcpServerSchema.nullable()).optional(),
  rules: z.array(ruleSchema.nullable()).optional(),
  prompts: z.array(promptSchema.nullable()).optional(),
  docs: z.array(docSchema.nullable()).optional(),
});

export type AgentSettings = z.infer<typeof agentSettingsSchema>;

export const resolvedAgentSettingsSchema = agentSettingsBaseSchema.extend({
  models: z.array(modelSchema).optional(),
  context: z.array(contextSchema).optional(),
  data: z.array(dataSchema).optional(),
  mcpServers: z.array(mcpServerSchema).optional(),
  rules: z.array(ruleSchema).optional(),
  prompts: z.array(promptSchema).optional(),
  docs: z.array(docSchema).optional(),
});

export type ResolvedAgentSettings = z.infer<typeof resolvedAgentSettingsSchema>;

export const isResolvedAgentSettings = (
  a: AgentSettings,
): a is ResolvedAgentSettings =>
  (!a.models || a.models.every((m) => m !== null)) &&
  (!a.context || a.context.every((c) => c !== null)) &&
  (!a.data || a.data.every((d) => d !== null)) &&
  (!a.mcpServers || a.mcpServers.every((s) => s !== null)) &&
  (!a.rules || a.rules.every((r) => r !== null)) &&
  (!a.prompts || a.prompts.every((p) => p !== null)) &&
  (!a.docs || a.docs.every((d) => d !== null));
