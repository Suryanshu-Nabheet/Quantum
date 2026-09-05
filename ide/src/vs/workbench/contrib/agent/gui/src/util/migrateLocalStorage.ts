import { ToolPolicy } from "terminal-security";
import { BuiltInToolNames } from "core/tools/builtIn";
import { clearToolPolicy, setToolPolicy } from "../redux/slices/uiSlice";
import { AppDispatch } from "../redux/store";

const validPolicyValues: ToolPolicy[] = [
  "allowedWithPermission",
  "allowedWithoutPermission",
  "disabled",
];
function migrateToolPolicies(dispatch: AppDispatch) {
  const toFromMap: Record<string, string[]> = {
    [BuiltInToolNames.ReadFile]: ["builtin_read_file"],
    [BuiltInToolNames.EditExistingFile]: ["builtin_edit_existing_file"],
    [BuiltInToolNames.ReadCurrentlyOpenFile]: [
      "builtin_read_currently_open_file",
    ],
    [BuiltInToolNames.CreateNewFile]: ["builtin_create_new_file"],
    [BuiltInToolNames.RunTerminalCommand]: ["builtin_run_terminal_command"],
    [BuiltInToolNames.GrepSearch]: ["builtin_grep_search"],
    [BuiltInToolNames.FileGlobSearch]: ["builtin_file_glob_search"],
    [BuiltInToolNames.ViewDiff]: ["builtin_view_diff"],
    [BuiltInToolNames.LSTool]: ["builtin_ls"],
    [BuiltInToolNames.CreateRuleBlock]: ["builtin_create_rule_block"],
    [BuiltInToolNames.RequestRule]: ["builtin_request_rule"],

    [BuiltInToolNames.ViewSubdirectory]: ["builtin_view_subdirectory"],
  };
  const persistedRedux = localStorage.getItem("persist:root");
  if (persistedRedux) {
    const uiState = JSON.parse(persistedRedux)?.ui;
    if (uiState) {
      const parsedSettings = JSON.parse(uiState)?.toolSettings;
      if (parsedSettings) {
        let migratedToolSettings = 0;
        Object.entries(toFromMap).forEach(([newToolName, oldToolNames]) => {
          for (const tool of oldToolNames) {
            if (
              tool in parsedSettings &&
              validPolicyValues.includes(parsedSettings[tool])
            ) {
              dispatch(
                setToolPolicy({
                  toolName: newToolName,
                  policy: parsedSettings[tool],
                }),
              );
              dispatch(clearToolPolicy(tool));
              migratedToolSettings++;
            }
          }
        });
        if (migratedToolSettings > 0) {
          console.log(
            `Migrated ${migratedToolSettings} tool policies successfully.`,
          );
        }
      }
    }
  }
}

const AUTONOMY_DEFAULTS_MIGRATION_KEY = "agent_autonomy_defaults_v002";

/** Tools that should auto-run without approval (read-only / safe-by-default). */
const AUTONOMOUS_TOOL_POLICIES: Record<string, ToolPolicy> = {
  [BuiltInToolNames.RunTerminalCommand]: "allowedWithoutPermission",
  [BuiltInToolNames.LSTool]: "allowedWithoutPermission",
  [BuiltInToolNames.ReadFile]: "allowedWithoutPermission",
  [BuiltInToolNames.ReadFileRange]: "allowedWithoutPermission",
  [BuiltInToolNames.ReadCurrentlyOpenFile]: "allowedWithoutPermission",
  [BuiltInToolNames.GrepSearch]: "allowedWithoutPermission",
  [BuiltInToolNames.FileGlobSearch]: "allowedWithoutPermission",
  [BuiltInToolNames.ViewDiff]: "allowedWithoutPermission",
  [BuiltInToolNames.ViewSubdirectory]: "allowedWithoutPermission",
};

/** One-time upgrade from legacy "always ask" defaults to autonomous agent behavior. */
function migrateAutonomyToolDefaults(dispatch: AppDispatch) {
  if (localStorage.getItem(AUTONOMY_DEFAULTS_MIGRATION_KEY)) {
    return;
  }

  const persistedRedux = localStorage.getItem("persist:root");
  if (!persistedRedux) {
    localStorage.setItem(AUTONOMY_DEFAULTS_MIGRATION_KEY, "1");
    return;
  }

  const uiState = JSON.parse(persistedRedux)?.ui;
  if (!uiState) {
    localStorage.setItem(AUTONOMY_DEFAULTS_MIGRATION_KEY, "1");
    return;
  }

  const parsedSettings = JSON.parse(uiState)?.toolSettings;
  if (!parsedSettings) {
    localStorage.setItem(AUTONOMY_DEFAULTS_MIGRATION_KEY, "1");
    return;
  }

  let upgraded = 0;
  for (const [toolName, newPolicy] of Object.entries(AUTONOMOUS_TOOL_POLICIES)) {
    if (
      parsedSettings[toolName] === "allowedWithPermission" ||
      parsedSettings[toolName] === undefined
    ) {
      dispatch(setToolPolicy({ toolName, policy: newPolicy }));
      upgraded++;
    }
  }

  if (upgraded > 0) {
    console.log(
      `Upgraded ${upgraded} tool policies to autonomous defaults (safe commands auto-approve).`,
    );
  }

  localStorage.setItem(AUTONOMY_DEFAULTS_MIGRATION_KEY, "1");
}

export function migrateLocalStorage(dispatch: AppDispatch) {
  migrateToolPolicies(dispatch);
  migrateAutonomyToolDefaults(dispatch);
}
