/**
 * Public contracts for the Quantum agent-control gateway.
 *
 * New gateway tools decode these schemas before doing any work. Keeping the
 * limits here ensures the MCP surface, server implementation, and tests share
 * the same definition of an exact creation/wait plan.
 */
import { Schema } from "effect";

import { ProjectId, ThreadId, TurnId } from "./baseSchemas";
import { ModelSelection, ProviderKind } from "./orchestration";
import { ProviderModelDescriptor } from "./providerDiscovery";
import { ServerProviderAuthStatus } from "./server";

export const QUANTUM_GATEWAY_MAX_THREADS_PER_OPERATION = 20;
export const QUANTUM_GATEWAY_MAX_REQUEST_ID_LENGTH = 256;
export const QUANTUM_GATEWAY_MAX_WAIT_MS = 60_000;

export const QuantumGatewayErrorCode = Schema.Literals([
  "caller_session_inactive",
  "caller_turn_inactive",
  "capability_denied",
  "provider_unavailable",
  "model_unavailable",
  "model_option_unavailable",
  "idempotency_conflict",
  "creation_plan_locked",
  "creation_limit_exceeded",
  "thread_not_found",
  "wait_timed_out",
  "operation_failed",
]);
export type QuantumGatewayErrorCode = typeof QuantumGatewayErrorCode.Type;

export const QuantumGatewayError = Schema.Struct({
  code: QuantumGatewayErrorCode,
  message: Schema.String,
  details: Schema.optional(Schema.Unknown),
});
export type QuantumGatewayError = typeof QuantumGatewayError.Type;

export const QuantumGatewayErrorResult = Schema.Struct({
  error: QuantumGatewayError,
});
export type QuantumGatewayErrorResult = typeof QuantumGatewayErrorResult.Type;

export const QuantumContextResult = Schema.Struct({
  harness: Schema.Struct({
    name: Schema.Literal("Quantum"),
    policyVersion: Schema.String,
  }),
  caller: Schema.Struct({
    threadId: ThreadId,
    turnId: Schema.NullOr(TurnId),
    provider: ProviderKind,
    projectId: ProjectId,
  }),
  capabilities: Schema.Struct({
    threadRead: Schema.Boolean,
    threadCreate: Schema.Boolean,
    threadWait: Schema.Boolean,
    automations: Schema.Boolean,
  }),
});
export type QuantumContextResult = typeof QuantumContextResult.Type;

export const QuantumCreateThreadSpec = Schema.Struct({
  prompt: Schema.String.check(Schema.isNonEmpty()),
  title: Schema.optional(Schema.String.check(Schema.isNonEmpty())),
  target: ModelSelection,
  projectId: Schema.optional(ProjectId),
  environment: Schema.optional(Schema.Literals(["local", "worktree"])),
  baseRef: Schema.optional(Schema.String.check(Schema.isNonEmpty())),
  // Legacy inputs remain decodable for replay/backward compatibility, but the
  // MCP catalog no longer advertises branch-backed worktree creation.
  baseBranch: Schema.optional(Schema.String.check(Schema.isNonEmpty())),
  branchName: Schema.optional(Schema.String.check(Schema.isNonEmpty())),
  runtimeMode: Schema.optional(Schema.Literals(["approval-required", "full-access"])),
});
export type QuantumCreateThreadSpec = typeof QuantumCreateThreadSpec.Type;

const QuantumGatewayRequestId = Schema.String.check(Schema.isNonEmpty()).check(
  Schema.isMaxLength(QUANTUM_GATEWAY_MAX_REQUEST_ID_LENGTH),
);

export const QuantumCreateThreadsInput = Schema.Struct({
  requestId: QuantumGatewayRequestId,
  threads: Schema.Array(QuantumCreateThreadSpec)
    .check(Schema.isMinLength(1))
    .check(Schema.isMaxLength(QUANTUM_GATEWAY_MAX_THREADS_PER_OPERATION)),
}).annotate({ parseOptions: { onExcessProperty: "error" } });
export type QuantumCreateThreadsInput = typeof QuantumCreateThreadsInput.Type;

export const QuantumProviderCatalog = Schema.Struct({
  provider: ProviderKind,
  defaultModel: Schema.NullOr(Schema.String),
  models: Schema.Array(ProviderModelDescriptor),
  enabled: Schema.Boolean,
  available: Schema.Boolean,
  authStatus: Schema.optional(ServerProviderAuthStatus),
  source: Schema.optional(Schema.String),
  error: Schema.optional(Schema.String),
});
export type QuantumProviderCatalog = typeof QuantumProviderCatalog.Type;

export const QuantumGatewayTargetOptionValue = Schema.Union([
  Schema.String,
  Schema.Number,
  Schema.Boolean,
]);
export type QuantumGatewayTargetOptionValue = typeof QuantumGatewayTargetOptionValue.Type;

export const QuantumGatewayTargetOptionRule = Schema.Struct({
  key: Schema.String,
  valueType: Schema.Literals(["string", "number", "boolean"]),
  allowedValues: Schema.Array(QuantumGatewayTargetOptionValue),
  allowedValuesSource: Schema.Literals(["provider-contract", "model-discovery"]),
});
export type QuantumGatewayTargetOptionRule = typeof QuantumGatewayTargetOptionRule.Type;

export const QuantumGatewayTargetConstruction = Schema.Struct({
  modelValueSource: Schema.Literal("providers[].models[].slug"),
  primaryOptionKey: Schema.String,
  alternativeOptionKeys: Schema.Array(Schema.String),
  optionSelectionRule: Schema.String,
  providerOptions: Schema.Array(QuantumGatewayTargetOptionRule),
  optionsByModel: Schema.Record(Schema.String, Schema.Array(QuantumGatewayTargetOptionRule)),
  exampleTarget: Schema.NullOr(ModelSelection),
});
export type QuantumGatewayTargetConstruction = typeof QuantumGatewayTargetConstruction.Type;

export const QuantumCapabilitiesResult = Schema.Struct({
  targetConstruction: Schema.Record(Schema.String, QuantumGatewayTargetConstruction),
  providers: Schema.Array(QuantumProviderCatalog),
  limits: Schema.Struct({
    maxThreadsPerOperation: Schema.Int,
    maxWaitMs: Schema.Int,
    oneCreationPlanPerActiveTurn: Schema.Boolean,
  }),
});
export type QuantumCapabilitiesResult = typeof QuantumCapabilitiesResult.Type;

export const QuantumCreatedThreadResult = Schema.Struct({
  index: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  threadId: ThreadId,
  projectId: ProjectId,
  title: Schema.String,
  target: ModelSelection,
  provider: ProviderKind,
  model: Schema.String,
  runtimeMode: Schema.Literals(["approval-required", "full-access"]),
  environment: Schema.Literals(["local", "worktree"]),
  branch: Schema.NullOr(Schema.String),
  worktreePath: Schema.NullOr(Schema.String),
  status: Schema.Literal("task_dispatched"),
});
export type QuantumCreatedThreadResult = typeof QuantumCreatedThreadResult.Type;

export const QuantumCreateThreadsResult = Schema.Struct({
  operationId: Schema.String,
  requestId: QuantumGatewayRequestId,
  requestedCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  createdCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  threadIds: Schema.Array(ThreadId),
  threads: Schema.Array(QuantumCreatedThreadResult),
});
export type QuantumCreateThreadsResult = typeof QuantumCreateThreadsResult.Type;

export const QuantumWaitForThreadsInput = Schema.Struct({
  threadIds: Schema.Array(ThreadId)
    .check(Schema.isMinLength(1))
    .check(Schema.isMaxLength(QUANTUM_GATEWAY_MAX_THREADS_PER_OPERATION)),
  runIds: Schema.optional(
    Schema.Array(Schema.NullOr(TurnId)).check(
      Schema.isMaxLength(QUANTUM_GATEWAY_MAX_THREADS_PER_OPERATION),
    ),
  ),
  timeoutMs: Schema.optional(
    Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)).check(
      Schema.isLessThanOrEqualTo(QUANTUM_GATEWAY_MAX_WAIT_MS),
    ),
  ),
}).annotate({ parseOptions: { onExcessProperty: "error" } });
export type QuantumWaitForThreadsInput = typeof QuantumWaitForThreadsInput.Type;

export const QuantumWaitedThreadResult = Schema.Struct({
  threadId: ThreadId,
  runId: Schema.NullOr(TurnId),
  state: Schema.Literals(["idle", "pending", "running", "completed", "error", "interrupted"]),
  terminal: Schema.Boolean,
  timedOut: Schema.Boolean,
  summary: Schema.NullOr(Schema.String),
  summaryTruncated: Schema.Boolean,
  error: Schema.NullOr(Schema.String),
  readThread: Schema.Struct({
    tool: Schema.Literal("quantum_read_thread"),
    arguments: Schema.Struct({ threadId: ThreadId }),
  }),
});
export type QuantumWaitedThreadResult = typeof QuantumWaitedThreadResult.Type;

export const QuantumWaitForThreadsResult = Schema.Struct({
  callerThreadId: ThreadId,
  runIds: Schema.Array(Schema.NullOr(TurnId)),
  allTerminal: Schema.Boolean,
  timedOut: Schema.Boolean,
  threads: Schema.Array(QuantumWaitedThreadResult),
});
export type QuantumWaitForThreadsResult = typeof QuantumWaitForThreadsResult.Type;
