import { z } from "zod";

export const completionOptionsSchema = z.object({
  temperature: z.number().optional(),
  topP: z.number().optional(),
  topK: z.number().optional(),
  minP: z.number().optional(),
  presencePenalty: z.number().optional(),
  frequencyPenalty: z.number().optional(),
  mirostat: z.number().optional(),
  stop: z.array(z.string()).optional(),
  maxTokens: z.number().optional(),
  numThreads: z.number().optional(),
  useMmap: z.boolean().optional(),
  keepAlive: z.number().optional(),
  numGpu: z.number().optional(),
  raw: z.boolean().optional(),
  stream: z.boolean().optional(),
});
export type CompletionOptions = z.infer<typeof completionOptionsSchema>;

export const clientCertificateOptionsSchema = z.object({
  cert: z.string(),
  key: z.string(),
  passphrase: z.string().optional(),
});
export type ClientCertificateOptions = z.infer<
  typeof clientCertificateOptionsSchema
>;

/** HTTP request options shared across LLM providers (used by fetch + adapters). */
export const requestOptionsSchema = z.object({
  timeout: z.number().optional(),
  verifySsl: z.boolean().optional(),
  caBundlePath: z.union([z.string(), z.array(z.string())]).optional(),
  proxy: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  extraBodyProperties: z.record(z.string(), z.any()).optional(),
  noProxy: z.array(z.string()).optional(),
  clientCertificate: clientCertificateOptionsSchema.optional(),
});
export type RequestOptions = z.infer<typeof requestOptionsSchema>;
