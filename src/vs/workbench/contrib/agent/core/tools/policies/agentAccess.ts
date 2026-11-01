import { ToolPolicy } from "terminal-security";
import { BuiltInToolNames } from "../builtIn";

/** High-level machine/filesystem access for the agent. */
export type AgentAccessMode = "full" | "sandboxed" | "strict";

/** Whether terminal commands auto-run or need approval. */
export type TerminalAutoExecution = "auto" | "allowlist" | "ask";

export const DEFAULT_AGENT_ACCESS_MODE: AgentAccessMode = "full";
export const DEFAULT_TERMINAL_AUTO_EXECUTION: TerminalAutoExecution = "auto";

const FILE_ACCESS_TOOLS = new Set<string>([
  BuiltInToolNames.ReadFile,
  BuiltInToolNames.ReadFileRange,
  BuiltInToolNames.ReadCurrentlyOpenFile,
  BuiltInToolNames.CreateNewFile,
  BuiltInToolNames.EditExistingFile,
  BuiltInToolNames.SingleFindAndReplace,
  BuiltInToolNames.MultiEdit,
  BuiltInToolNames.LSTool,
  BuiltInToolNames.ViewSubdirectory,
  BuiltInToolNames.FileGlobSearch,
  BuiltInToolNames.GrepSearch,
]);

/**
 * Apply Quantum Agent Access + Terminal Auto Execution on top of the
 * per-call security evaluation. Hard `disabled` (blocked) always wins.
 */
export function applyAgentAccessModes(
  toolName: string,
  policy: ToolPolicy,
  agentAccess: AgentAccessMode = DEFAULT_AGENT_ACCESS_MODE,
  terminalAutoExecution: TerminalAutoExecution = DEFAULT_TERMINAL_AUTO_EXECUTION,
): ToolPolicy {
  if (policy === "disabled") {
    return "disabled";
  }

  if (toolName === BuiltInToolNames.RunTerminalCommand) {
    // Strict always requires terminal review, regardless of auto-execution setting.
    if (agentAccess === "strict" || terminalAutoExecution === "ask") {
      return "allowedWithPermission";
    }
    if (terminalAutoExecution === "auto") {
      return "allowedWithoutPermission";
    }
    // allowlist: keep evaluateTerminalCommandSecurity result
    return policy;
  }

  if (FILE_ACCESS_TOOLS.has(toolName)) {
    // Outside-workspace evaluation returns allowedWithPermission today.
    if (policy === "allowedWithPermission") {
      if (agentAccess === "full") {
        return "allowedWithoutPermission";
      }
      if (agentAccess === "strict") {
        return "disabled";
      }
    }
  }

  return policy;
}
