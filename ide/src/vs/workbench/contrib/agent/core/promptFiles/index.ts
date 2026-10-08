import { ContextProviderName } from "..";

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
