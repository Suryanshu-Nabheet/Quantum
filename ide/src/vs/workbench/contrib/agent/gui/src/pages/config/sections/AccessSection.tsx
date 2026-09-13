import type {
  AgentAccessMode,
  TerminalAutoExecution,
} from "core/tools/policies/agentAccess";
import {
  DEFAULT_AGENT_ACCESS_MODE,
  DEFAULT_TERMINAL_AUTO_EXECUTION,
} from "core/tools/policies/agentAccess";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import {
  setAgentAccessMode,
  setTerminalAutoExecution,
} from "../../../redux/slices/uiSlice";
import { CONFIG_ROUTES } from "../../../util/navigation";
import {
  AccessModeChoice,
  AccessModeGroup,
  AccessModeStack,
} from "../components/AccessModeOption";
import { ConfigCrossLink } from "../components/ConfigCrossLink";
import { ConfigHeader } from "../components/ConfigHeader";
import { CONFIG_PAGE_GAP } from "../configLayout";

const AGENT_ACCESS_CHOICES: AccessModeChoice<AgentAccessMode>[] = [
  {
    value: "full",
    title: "Full access",
    description:
      "Agents have full access to your machine and external resources.",
  },
  {
    value: "sandboxed",
    title: "Sandboxed",
    description:
      "Agents run in a secure sandbox that restricts access to external resources outside of your trusted folders.",
  },
  {
    value: "strict",
    title: "Strict",
    description:
      "Terminal commands always require review and the agent cannot access files outside of its given workspaces.",
  },
];

const TERMINAL_AUTO_CHOICES: AccessModeChoice<TerminalAutoExecution>[] = [
  {
    value: "auto",
    title: "Run Everything",
    description: "Allow all commands to run without asking for confirmation.",
  },
  {
    value: "allowlist",
    title: "Use Allowlist",
    description:
      "Auto-run commands that pass the built-in safety check; ask before running anything else.",
  },
  {
    value: "ask",
    title: "Ask Every Time",
    description: "Require approval before every terminal command runs.",
  },
];

export function AccessSection() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const agentAccessMode =
    useAppSelector((store) => store.ui.agentAccessMode) ??
    DEFAULT_AGENT_ACCESS_MODE;
  const terminalAutoExecution =
    useAppSelector((store) => store.ui.terminalAutoExecution) ??
    DEFAULT_TERMINAL_AUTO_EXECUTION;

  const terminalLockedByStrict = agentAccessMode === "strict";

  return (
    <div className={CONFIG_PAGE_GAP}>
      <ConfigHeader
        title="Access"
        subtext="Control how much access the agent has to your machine, files, and terminal"
        showAddButton={false}
      />

      <AccessModeStack>
        <AccessModeGroup
          title="Agent Access"
          description="Filesystem and external resource permissions for the agent."
          name="agent-access-mode"
          value={agentAccessMode}
          choices={AGENT_ACCESS_CHOICES}
          onChange={(value) => dispatch(setAgentAccessMode(value))}
        />

        <AccessModeGroup
          title="Terminal Command Auto Execution"
          description="Whether terminal commands require your approval before running."
          name="terminal-auto-execution"
          value={terminalLockedByStrict ? "ask" : terminalAutoExecution}
          choices={TERMINAL_AUTO_CHOICES}
          onChange={(value) => dispatch(setTerminalAutoExecution(value))}
          disabled={terminalLockedByStrict}
          disabledHint="Strict mode always requires terminal review. Change Agent Access to edit this setting."
        />
      </AccessModeStack>

      <ConfigCrossLink onClick={() => navigate(CONFIG_ROUTES.MCP)}>
        Manage MCP server tools separately
      </ConfigCrossLink>
    </div>
  );
}
