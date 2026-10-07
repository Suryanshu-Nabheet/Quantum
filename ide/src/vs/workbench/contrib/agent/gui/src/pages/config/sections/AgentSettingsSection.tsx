import { ModelRole } from "agent-config";
import { ModelDescription } from "core";
import {
  SharedConfigSchema,
  modifyAnyConfigWithSharedConfig,
} from "core/config/sharedConfig";
import type {
  AgentAccessMode,
  TerminalAutoExecution,
} from "core/tools/policies/agentAccess";
import {
  DEFAULT_AGENT_ACCESS_MODE,
  DEFAULT_TERMINAL_AUTO_EXECUTION,
} from "core/tools/policies/agentAccess";
import { DEFAULT_PROTECTED_FILE_PATTERNS } from "core/tools/policies/protectedPaths";
import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import Shortcut from "../../../components/gui/Shortcut";
import { Button, Card, Divider } from "../../../components/ui";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { AddModelForm } from "../../../forms/AddModelForm";
import { useConfigureModelDialog } from "../../../hooks/useConfigureModelDialog";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { updateConfig } from "../../../redux/slices/configSlice";
import { selectSelectedProfile } from "../../../redux/slices/profilesSlice";
import {
  setAgentAccessMode,
  setDialogMessage,
  setProtectedFilePatterns,
  setProtectedPathsRequireReadApproval,
  setShowDialog,
  setTerminalAutoExecution,
} from "../../../redux/slices/uiSlice";
import { updateSelectedModelByRole } from "../../../redux/thunks/updateSelectedModelByRole";
import { updateUnifiedChatModel } from "../../../redux/thunks/updateUnifiedChatModel";
import { getMetaKeyLabel } from "../../../util";
import { DEFAULT_MAX_AGENT_STEPS } from "../../../util/agentLoopLimits";
import { buildConfigRoute, CONFIG_ROUTES } from "../../../util/navigation";
import {
  AccessModeChoice,
  AccessModeGroup,
  AccessModeStack,
} from "../components/AccessModeOption";
import { ConfigCrossLink } from "../components/ConfigCrossLink";
import { ConfigDisclosurePanel } from "../components/ConfigDisclosurePanel";
import { ConfigHeader } from "../components/ConfigHeader";
import { ModelRoleRow } from "../components/ModelRoleRow";
import { PathPatternsEditor } from "../components/PathPatternsEditor";
import { UserSetting } from "../components/UserSetting";
import { CONFIG_CARD_STACK, CONFIG_PAGE_GAP } from "../configLayout";

const DEFAULT_PROVIDER_ROLES: ModelRole[] = [
  "chat",
  "apply",
  "edit",
  "autocomplete",
];

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

const PROTECTED_PATH_SUGGESTIONS = [
  ".env",
  ".env.*",
  "**/*.pem",
  "**/*.key",
  "**/secrets/**",
];

function ConfigSubsectionTitle({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-3">
      <p className="text-sm font-medium leading-5">{title}</p>
      {description && (
        <p className="text-description mt-1 text-xs leading-snug">
          {description}
        </p>
      )}
    </div>
  );
}

export function AgentSettingsSection() {
  const selectedProfile = useAppSelector(selectSelectedProfile);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const ideMessenger = useContext(IdeMessengerContext);
  const config = useAppSelector((state) => state.config.config);
  const openConfigureModelDialog = useConfigureModelDialog();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const agentAccessMode =
    useAppSelector((store) => store.ui.agentAccessMode) ??
    DEFAULT_AGENT_ACCESS_MODE;
  const terminalAutoExecution =
    useAppSelector((store) => store.ui.terminalAutoExecution) ??
    DEFAULT_TERMINAL_AUTO_EXECUTION;
  const protectedFilePatterns = useAppSelector(
    (store) => store.ui.protectedFilePatterns,
  );
  const protectedPathsRequireReadApproval = useAppSelector(
    (store) => store.ui.protectedPathsRequireReadApproval,
  );

  const terminalLockedByStrict = agentAccessMode === "strict";
  const maxAgentSteps = config.ui?.maxAgentSteps ?? DEFAULT_MAX_AGENT_STEPS;

  function handleSharedConfigUpdate(sharedConfig: SharedConfigSchema) {
    const updatedConfig = modifyAnyConfigWithSharedConfig(config, sharedConfig);
    dispatch(updateConfig(updatedConfig));
    ideMessenger.post("config/updateSharedConfig", sharedConfig);
  }

  function handleAgentModelSelect(model: ModelDescription | null) {
    if (!model) {
      return;
    }
    void dispatch(
      updateUnifiedChatModel({
        modelTitle: model.title,
        selectedProfile,
      }),
    );
  }

  function handleAdvancedRoleUpdate(
    role: ModelRole,
    model: ModelDescription | null,
  ) {
    if (!model) {
      return;
    }
    void dispatch(
      updateSelectedModelByRole({
        role,
        modelTitle: model.title,
        selectedProfile,
      }),
    );
  }

  function openAddProviderDialog() {
    dispatch(setShowDialog(true));
    dispatch(
      setDialogMessage(
        <AddModelForm
          roles={DEFAULT_PROVIDER_ROLES}
          formTitle="Add provider"
          onDone={() => dispatch(setShowDialog(false))}
        />,
      ),
    );
  }

  return (
    <div className={CONFIG_PAGE_GAP}>
      <ConfigHeader
        title="Agent"
        subtext="Model, permissions, protected paths, and loop limits for the Agent sidebar and tools."
        showAddButton={false}
      />

      <ConfigCrossLink onClick={() => navigate(buildConfigRoute("models"))}>
        Manage providers — API keys and credentials
      </ConfigCrossLink>

      <div className="flex flex-col gap-4">
        <Card>
          <ModelRoleRow
            role="chat"
            displayName="Agent model"
            shortcut={
              <span className="text-2xs text-description-muted">
                (<Shortcut>{`${getMetaKeyLabel()} L`}</Shortcut> focus ·{" "}
                <Shortcut>{`${getMetaKeyLabel()} I`}</Shortcut> edit)
              </span>
            }
            description="Used in the Agent sidebar (Chat, Plan, and Agent modes), inline edit, and apply."
            models={config.modelsByRole.chat}
            selectedModel={config.selectedModelByRole.chat ?? undefined}
            onSelect={handleAgentModelSelect}
            onConfigure={(model) => model && openConfigureModelDialog(model)}
            onAddModel={openAddProviderDialog}
          />
        </Card>

        <ConfigDisclosurePanel
          open={showAdvanced}
          onToggle={() => setShowAdvanced((v) => !v)}
          label="Show context & search models (optional)"
          expandedLabel="Hide context & search models (optional)"
        >
          <ModelRoleRow
            role="embed"
            displayName="Embeddings"
            description="Improves @-mention and codebase context retrieval. Defaults to a local model if unset."
            models={config.modelsByRole.embed}
            selectedModel={config.selectedModelByRole.embed ?? undefined}
            onSelect={(m) => handleAdvancedRoleUpdate("embed", m)}
            onConfigure={(model) => model && openConfigureModelDialog(model)}
            onAddModel={openAddProviderDialog}
          />
          <Divider />
          <ModelRoleRow
            role="rerank"
            displayName="Rerank"
            description="Reorders retrieved snippets for better relevance."
            models={config.modelsByRole.rerank}
            selectedModel={config.selectedModelByRole.rerank ?? undefined}
            onSelect={(m) => handleAdvancedRoleUpdate("rerank", m)}
            onConfigure={(model) => model && openConfigureModelDialog(model)}
            onAddModel={openAddProviderDialog}
          />
        </ConfigDisclosurePanel>

        <Card>
          <ConfigSubsectionTitle
            title="Permissions"
            description="Filesystem and terminal behavior for agent tool calls."
          />
          <AccessModeStack>
            <AccessModeGroup
              title="Agent access"
              description="How far the agent can reach outside the workspace."
              name="agent-access-mode"
              value={agentAccessMode}
              choices={AGENT_ACCESS_CHOICES}
              onChange={(value) => dispatch(setAgentAccessMode(value))}
            />
            <AccessModeGroup
              title="Terminal auto execution"
              description="Whether shell commands need approval before they run."
              name="terminal-auto-execution"
              value={terminalLockedByStrict ? "ask" : terminalAutoExecution}
              choices={TERMINAL_AUTO_CHOICES}
              onChange={(value) => dispatch(setTerminalAutoExecution(value))}
              disabled={terminalLockedByStrict}
              disabledHint="Strict mode always requires terminal review. Choose a less restrictive agent access mode to change this."
            />
          </AccessModeStack>
        </Card>

        <Card>
          <ConfigSubsectionTitle
            title="Protected paths"
            description="Glob patterns for sensitive files. The agent must get your approval before touching matching paths — even in Full access mode."
          />
          <div className="flex flex-col gap-3">
            <PathPatternsEditor
              patterns={protectedFilePatterns}
              onChange={(patterns) =>
                dispatch(setProtectedFilePatterns(patterns))
              }
              emptyMessage="No protected paths — only built-in security blocks (e.g. .ssh) apply."
              inputPlaceholder="e.g. .env or **/secrets/**"
              suggestedPatterns={PROTECTED_PATH_SUGGESTIONS}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="my-0"
                onClick={() =>
                  dispatch(
                    setProtectedFilePatterns([
                      ...DEFAULT_PROTECTED_FILE_PATTERNS,
                    ]),
                  )
                }
              >
                Restore defaults
              </Button>
            </div>
            <UserSetting
              type="toggle"
              title="Require approval to read protected files"
              description="When off, only writes and edits on protected paths need confirmation; reads can still auto-run in Full access mode."
              value={protectedPathsRequireReadApproval}
              onChange={(value) =>
                dispatch(setProtectedPathsRequireReadApproval(value))
              }
            />
          </div>
        </Card>

        <Card>
          <ConfigSubsectionTitle
            title="Agent loop"
            description="Limits how many model and tool rounds run from a single message before the agent pauses."
          />
          <div className={CONFIG_CARD_STACK}>
            <UserSetting
              type="number"
              title="Max steps per message"
              description="Each tool call and follow-up model turn counts as one step. Send another message to continue after the limit."
              value={maxAgentSteps}
              onChange={(val) =>
                handleSharedConfigUpdate({ maxAgentSteps: val })
              }
              min={5}
              max={2000}
            />
          </div>
        </Card>
      </div>

      <ConfigCrossLink onClick={() => navigate(CONFIG_ROUTES.MCP)}>
        Manage MCP server tools separately
      </ConfigCrossLink>
    </div>
  );
}
