export enum BuiltInToolNames {
  ReadFile = "read_file",
  ReadFileRange = "read_file_range",
  EditExistingFile = "edit_existing_file",
  SingleFindAndReplace = "single_find_and_replace",
  MultiEdit = "multi_edit",
  ReadCurrentlyOpenFile = "read_currently_open_file",
  CreateNewFile = "create_new_file",
  RunTerminalCommand = "run_terminal_command",
  GrepSearch = "grep_search",
  FileGlobSearch = "file_glob_search",
  ViewDiff = "view_diff",
  LSTool = "ls",
  CreateRuleBlock = "create_rule_block",
  RequestRule = "request_rule",

  ReadSkill = "read_skill",

  WriteTodos = "write_todos",
  CreatePlan = "create_plan",

  // excluded from allTools for now
  ViewSubdirectory = "view_subdirectory",
}

export const BUILT_IN_GROUP_NAME = "Built-In";

const TOOL_NAME_ALIASES: Record<string, BuiltInToolNames> = {
  list: BuiltInToolNames.LSTool,
  list_dir: BuiltInToolNames.LSTool,
  list_directory: BuiltInToolNames.LSTool,
  list_files: BuiltInToolNames.LSTool,
};

/** Map names small models invent (`list`) onto the real built-in (`ls`). */
export function canonicalToolName(name: string): string {
  return TOOL_NAME_ALIASES[name] ?? name;
}

export const CLIENT_TOOLS_IMPLS = [
  BuiltInToolNames.EditExistingFile,
  BuiltInToolNames.SingleFindAndReplace,
  BuiltInToolNames.MultiEdit,
];
