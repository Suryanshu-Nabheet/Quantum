import { ContextProviderName } from "..";

export const DEFAULT_PROMPTS_FOLDER_V2 = ".agent/prompts";
export const DEFAULT_RULES_FOLDER = ".agent/rules";

// Subdirectory names (without .agent/ prefix)
export const RULES_DIR_NAME = "rules";
export const PROMPTS_DIR_NAME = "prompts";

export const SUPPORTED_PROMPT_CONTEXT_PROVIDERS: ContextProviderName[] = [
  "file",
  "problems",
  "terminal",
  "diff",
  "branch",
  "commit",
  "folder",
  "rules",
  "browser",
];
