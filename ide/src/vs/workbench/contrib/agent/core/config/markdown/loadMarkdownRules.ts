import {
  ConfigValidationError,
  markdownToRule,
} from "agent-config";
import { IDE, RuleWithSource } from "../..";
import { joinPathsToUri } from "../../util/uri";

export const SUPPORTED_AGENT_FILES = ["AGENTS.md", "AGENT.md", "CLAUDE.md"];

/**
 * Loads project-level agent instruction files (AGENTS.md, AGENT.md, CLAUDE.md)
 * from the workspace root. User rules are stored in Quantum Settings (globalContext).
 */
export async function loadProjectAgentMarkdownRules(ide: IDE): Promise<{
  rules: RuleWithSource[];
  errors: ConfigValidationError[];
}> {
  const errors: ConfigValidationError[] = [];
  const rules: RuleWithSource[] = [];

  const workspaceDirs = await ide.getWorkspaceDirs();

  for (const workspaceDir of workspaceDirs) {
    let agentFileFound = false;
    for (const fileName of SUPPORTED_AGENT_FILES) {
      try {
        const agentFileUri = joinPathsToUri(workspaceDir, fileName);
        const exists = await ide.fileExists(agentFileUri);
        if (exists) {
          const agentContent = await ide.readFile(agentFileUri);

          const rule = markdownToRule(agentContent, {
            uriType: "file",
            fileUri: agentFileUri,
          });
          rules.push({
            ...rule,
            source: "agentFile",
            sourceFile: agentFileUri,
            alwaysApply: true,
          });
          agentFileFound = true;
        }

        break;
      } catch {
        // File doesn't exist or can't be read, skip to next file
      }
    }
    if (agentFileFound) {
      break;
    }
  }

  return { rules, errors };
}
