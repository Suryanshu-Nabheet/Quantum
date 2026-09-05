import {
    ArrowTopRightOnSquareIcon,
    BookmarkIcon as BookmarkOutline,
    EyeIcon,
    PencilIcon,
    TrashIcon,
} from "@heroicons/react/24/outline";
import { BookmarkIcon as BookmarkSolid } from "@heroicons/react/24/solid";
import {
    BrowserSerializedAgentConfig,
    RuleSource,
    RuleWithSource,
    SlashCommandDescWithSource,
} from "core";
import {
    parseQuantumSettingsPromptId,
    parseQuantumSettingsRuleId,
} from "core/config/guiUris";
import {
    DEFAULT_AGENT_SYSTEM_MESSAGE,
    DEFAULT_CHAT_SYSTEM_MESSAGE,
    DEFAULT_PLAN_SYSTEM_MESSAGE,
} from "core/llm/defaultSystemMessages";
import { getRuleDisplayName } from "core/llm/rules/rules-utils";
import { useContext, useMemo, useState } from "react";
import { DropdownButton } from "../../../components/DropdownButton";
import AddPromptDialog from "../../../components/dialogs/AddPromptDialog";
import AddRuleDialog from "../../../components/dialogs/AddRuleDialog";
import AddSkillDialog from "../../../components/dialogs/AddSkillDialog";
import ConfirmationDialog from "../../../components/dialogs/ConfirmationDialog";
import HeaderButtonWithToolTip from "../../../components/gui/HeaderButtonWithToolTip";
import Switch from "../../../components/gui/Switch";
import { useOpenRule } from "../../../components/mainInput/Lump/useEditBlock";
import { useMainEditor } from "../../../components/mainInput/TipTapEditor/MainEditorProvider";
import { Card } from "../../../components/ui";
import { ConfigEmptyAction } from "../components/ConfigEmptyAction";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useBookmarkedSlashCommands } from "../../../hooks/useBookmarkedSlashCommands";
import { useSkills, type DetectedSkill } from "../../../hooks/useSkills";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { selectSelectedProfile } from "../../../redux/slices/profilesSlice";
import {
    DEFAULT_RULE_SETTING,
    setDialogMessage,
    setShowDialog,
    toggleRuleSetting,
} from "../../../redux/slices/uiSlice";
import { fontSize } from "../../../util";
import { ConfigHeader } from "../components/ConfigHeader";
import { CONFIG_HAIRLINE_DIVIDE, CONFIG_PAGE_GAP } from "../configLayout";

interface PromptCommandWithSlug extends SlashCommandDescWithSource {
  slug?: string;
}

interface PromptRowProps {
  prompt: PromptCommandWithSlug;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  onView: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

/**
 * A single prompt row: name + description on the left, an aligned action group
 * (view, edit, delete, bookmark) on the right. Clicking the row inserts the
 * prompt into the active chat editor when one is available.
 */
function PromptRow({
  prompt,
  isBookmarked,
  onToggleBookmark,
  onView,
  onEdit,
  onDelete,
}: PromptRowProps) {
  const { mainEditor } = useMainEditor();

  const handleRowClick = () => {
    if (mainEditor) {
      mainEditor.commands.insertPrompt({
        title: prompt.name,
        description: prompt.description,
        content: prompt.prompt,
      });
    } else {
      onView();
    }
  };

  const stop =
    (fn: () => void) =>
    (e: React.MouseEvent) => {
      e.stopPropagation();
      fn();
    };

  return (
    <div
      className="hover:bg-list-active hover:text-list-active-foreground flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 transition-colors"
      onClick={handleRowClick}
    >
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">{prompt.name}</span>
        <span className="text-description line-clamp-2 text-xs leading-snug">
          {prompt.description}
        </span>
      </div>
      <div className="flex flex-shrink-0 items-center gap-1">
        <HeaderButtonWithToolTip onClick={stop(onView)} text="View">
          <EyeIcon className="text-description h-3 w-3" />
        </HeaderButtonWithToolTip>
        {onEdit && (
          <HeaderButtonWithToolTip onClick={stop(onEdit)} text="Edit">
            <PencilIcon className="text-description h-3 w-3" />
          </HeaderButtonWithToolTip>
        )}
        {onDelete && (
          <HeaderButtonWithToolTip onClick={stop(onDelete)} text="Delete">
            <TrashIcon className="text-description h-3 w-3" />
          </HeaderButtonWithToolTip>
        )}
        <HeaderButtonWithToolTip
          onClick={stop(onToggleBookmark)}
          text={isBookmarked ? "Remove bookmark" : "Bookmark"}
        >
          {isBookmarked ? (
            <BookmarkSolid className="text-description h-3 w-3" />
          ) : (
            <BookmarkOutline className="text-description h-3 w-3" />
          )}
        </HeaderButtonWithToolTip>
      </div>
    </div>
  );
}

interface RuleCardProps {
  rule: RuleWithSource;
}

const RuleCard: React.FC<RuleCardProps> = ({ rule }) => {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const policy = useAppSelector((state) =>
    rule.name
      ? state.ui.ruleSettings[rule.name] || DEFAULT_RULE_SETTING
      : undefined,
  );

  const isDisabled = policy === "off";
  const openRule = useOpenRule();
  const handleTogglePolicy = () => {
    if (rule.name) {
      dispatch(toggleRuleSetting(rule.name));
    }
  };

  const title = useMemo(() => {
    return getRuleDisplayName(rule);
  }, [rule]);

  function onClickExpand() {
    dispatch(setShowDialog(true));
    dispatch(
      setDialogMessage(
        <div className="flex max-h-[70vh] flex-col gap-2 overflow-auto p-4">
          <h3 className="my-0 text-base font-semibold">{title}</h3>
          <pre className="bg-input mt-1 whitespace-pre-wrap break-words rounded p-3 text-xs leading-relaxed">
            {rule.rule}
          </pre>
        </div>,
      ),
    );
  }

  const ruleId = parseQuantumSettingsRuleId(rule.sourceFile);

  const handleEdit = () => {
    if (rule.source === "quantum-settings" && ruleId) {
      dispatch(setShowDialog(true));
      dispatch(
        setDialogMessage(
          <AddRuleDialog
            existingRule={{
              ruleId,
              name: rule.name ?? "",
              description: rule.description,
              content: rule.rule,
              globs: rule.globs,
              regex: rule.regex,
              alwaysApply: rule.alwaysApply,
              invokable: rule.invokable,
            }}
          />,
        ),
      );
      return;
    }
    openRule(rule);
  };

  const handleDelete = () => {
    if (!ruleId) {
      return;
    }

    dispatch(
      setDialogMessage(
        <ConfirmationDialog
          title="Delete Rule"
          text="Are you sure you want to delete this rule?"
          confirmText="Delete"
          onConfirm={async () => {
            try {
              await ideMessenger.request("config/deleteRule", { ruleId });
            } catch (error) {
              console.error("Failed to delete rule:", error);
            }
          }}
        />,
      ),
    );
    dispatch(setShowDialog(true));
  };

  const canDeleteRule = rule.source === "quantum-settings" && Boolean(ruleId);
  const isDefaultRule =
    rule.source === "default-chat" ||
    rule.source === "default-agent" ||
    rule.source === "default-plan";

  const tinyFont = fontSize(-3);
  return (
    <div
      className={`flex flex-col px-4 py-2.5 transition-colors ${isDisabled ? "opacity-50" : ""}`}
    >
      <div className="flex flex-col">
        <div className="flex flex-row items-start justify-between gap-2">
          <span
            className={`line-clamp-2 text-sm font-medium ${isDisabled ? "text-description" : ""}`}
          >
            {title}
          </span>
          <div className="flex flex-row items-center gap-2">
            {rule.name && policy && (
              <div className="flex cursor-pointer flex-row items-center justify-end gap-1 px-2 py-0.5">
                <Switch
                  isToggled={policy === "on"}
                  onToggle={() => handleTogglePolicy()}
                  size={10}
                  text=""
                />
              </div>
            )}
            <div className="flex flex-shrink-0 flex-row items-center gap-1">
              <HeaderButtonWithToolTip onClick={onClickExpand} text="View">
                <EyeIcon className="text-description h-3 w-3" />
              </HeaderButtonWithToolTip>
              {!isDefaultRule && (
                <HeaderButtonWithToolTip onClick={handleEdit} text="Edit">
                  <PencilIcon className="text-description h-3 w-3" />
                </HeaderButtonWithToolTip>
              )}
              {canDeleteRule && (
                <HeaderButtonWithToolTip onClick={handleDelete} text="Delete">
                  <TrashIcon className="text-description h-3 w-3" />
                </HeaderButtonWithToolTip>
              )}
            </div>
          </div>
        </div>

        <span
          style={{
            fontSize: tinyFont,
          }}
          className={`mt-1 line-clamp-3 ${isDisabled ? "text-description" : "text-description"}`}
        >
          {rule.rule}
        </span>
        {rule.globs ? (
          <div
            style={{
              fontSize: tinyFont,
            }}
            className="mt-1.5 flex flex-col gap-1"
          >
            <span className="italic">Applies to files</span>
            <code
              className={`line-clamp-1 px-1 py-0.5 ${isDisabled ? "text-description" : "text-description"}`}
            >
              {rule.globs}
            </code>
          </div>
        ) : null}
      </div>
    </div>
  );
};

/**
 * Section that displays all available prompts with bookmarking functionality
 */
function PromptsSubSection() {
  const dispatch = useAppDispatch();
  const { isCommandBookmarked, toggleBookmark } = useBookmarkedSlashCommands();
  const ideMessenger = useContext(IdeMessengerContext);

  const slashCommands = useAppSelector(
    (state) => state.config.config.slashCommands ?? [],
  );

  const handleEdit = (prompt: PromptCommandWithSlug) => {
    const promptId = parseQuantumSettingsPromptId(prompt.sourceFile);
    if (promptId) {
      dispatch(setShowDialog(true));
      dispatch(
        setDialogMessage(
          <AddPromptDialog
            existingPrompt={{
              promptId,
              name: prompt.name,
              description: prompt.description,
              prompt: prompt.prompt ?? "",
            }}
          />,
        ),
      );
      return;
    }

    if (prompt.sourceFile) {
      void ideMessenger.ide.openFile(prompt.sourceFile);
    }
  };

  const handleAddPrompt = () => {
    dispatch(setShowDialog(true));
    dispatch(setDialogMessage(<AddPromptDialog />));
  };

  const handleViewPrompt = (prompt: PromptCommandWithSlug) => {
    dispatch(setShowDialog(true));
    dispatch(
      setDialogMessage(
        <div className="flex max-h-[70vh] flex-col gap-2 overflow-auto p-4">
          <h3 className="my-0 text-base font-semibold">{prompt.name}</h3>
          {prompt.description && (
            <p className="text-description my-0 text-sm">
              {prompt.description}
            </p>
          )}
          <pre className="bg-input mt-1 whitespace-pre-wrap break-words rounded p-3 text-xs leading-relaxed">
            {prompt.prompt}
          </pre>
        </div>,
      ),
    );
  };

  const handleDeletePrompt = (prompt: PromptCommandWithSlug) => {
    const promptId = parseQuantumSettingsPromptId(prompt.sourceFile);
    if (!promptId) {
      return;
    }

    dispatch(
      setDialogMessage(
        <ConfirmationDialog
          title="Delete Prompt"
          text="Are you sure you want to delete this prompt?"
          confirmText="Delete"
          onConfirm={async () => {
            try {
              await ideMessenger.request("config/deletePrompt", { promptId });
            } catch (error) {
              console.error("Failed to delete prompt:", error);
            }
          }}
        />,
      ),
    );
    dispatch(setShowDialog(true));
  };

  const sortedCommands = useMemo(() => {
    return [...slashCommands].sort((a, b) => {
      const aBookmarked = isCommandBookmarked(a.name);
      const bBookmarked = isCommandBookmarked(b.name);
      if (aBookmarked && !bBookmarked) return -1;
      if (!aBookmarked && bBookmarked) return 1;
      return 0;
    });
  }, [slashCommands, isCommandBookmarked]);

  return (
    <div>
      <ConfigHeader
        title="Prompts"
        subtext="Reusable slash commands you can insert in chat"
        variant="sm"
        onAddClick={handleAddPrompt}
        addButtonTooltip="Add prompt"
      />

      {sortedCommands.length > 0 ? (
        <Card className="!p-0 overflow-hidden">
          <div className={CONFIG_HAIRLINE_DIVIDE}>
            {sortedCommands.map((prompt) => {
              const isGuiPrompt = Boolean(
                parseQuantumSettingsPromptId(prompt.sourceFile),
              );
              return (
                <PromptRow
                  key={prompt.name}
                  prompt={prompt}
                  isBookmarked={isCommandBookmarked(prompt.name)}
                  onToggleBookmark={() => toggleBookmark(prompt)}
                  onView={() => handleViewPrompt(prompt)}
                  onEdit={isGuiPrompt ? () => handleEdit(prompt) : undefined}
                  onDelete={
                    isGuiPrompt ? () => handleDeletePrompt(prompt) : undefined
                  }
                />
              );
            })}
          </div>
        </Card>
      ) : (
        <ConfigEmptyAction
          status="No prompts configured"
          actionLabel="Add prompt"
          onClick={handleAddPrompt}
        />
      )}
    </div>
  );
}

/**
 * Helper function to add the appropriate default system message based on mode
 */
function addDefaultSystemMessage(
  rules: RuleWithSource[],
  mode: string,
  config: BrowserSerializedAgentConfig,
) {
  const modeConfig = {
    chat: {
      customMessage: config.selectedModelByRole.chat?.baseChatSystemMessage,
      defaultMessage: DEFAULT_CHAT_SYSTEM_MESSAGE,
      customSource: "model-options-chat" as RuleSource,
      defaultSource: "default-chat" as RuleSource,
    },
    agent: {
      customMessage: config.selectedModelByRole.chat?.baseAgentSystemMessage,
      defaultMessage: DEFAULT_AGENT_SYSTEM_MESSAGE,
      customSource: "model-options-agent" as RuleSource,
      defaultSource: "default-agent" as RuleSource,
    },
    plan: {
      customMessage: config.selectedModelByRole.chat?.basePlanSystemMessage,
      defaultMessage: DEFAULT_PLAN_SYSTEM_MESSAGE,
      customSource: "model-options-plan" as RuleSource,
      defaultSource: "default-plan" as RuleSource,
    },
  };

  const currentMode = modeConfig[mode as keyof typeof modeConfig];
  if (currentMode) {
    const message = currentMode.customMessage || currentMode.defaultMessage;
    const source = currentMode.customMessage
      ? currentMode.customSource
      : currentMode.defaultSource;

    rules.unshift({
      rule: message,
      source,
    });
  }
}

// Define dropdown options for global rules
const globalRulesOptions = [
  { value: "workspace", label: "Current workspace" },
  { value: "global", label: "Global" },
];

function RulesSubSection() {
  const selectedProfile = useAppSelector(selectSelectedProfile);
  const config = useAppSelector((store) => store.config.config);
  const mode = useAppSelector((store) => store.session.mode);
  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useAppDispatch();
  const isLocal = selectedProfile?.profileType === "local";
  const [globalRulesMode, setGlobalRulesMode] = useState<string>("workspace");
  const configLoading = useAppSelector((store) => store.config.loading);

  const handleAddRule = (mode?: string) => {
    const currentMode = mode || globalRulesMode;
    dispatch(setShowDialog(true));
    dispatch(
      setDialogMessage(
        <AddRuleDialog
          mode={currentMode === "global" ? "global" : "workspace"}
        />,
      ),
    );
  };

  const handleOptionClick = (value: string) => {
    setGlobalRulesMode(value);
    handleAddRule(value);
  };

  const sortedRules: RuleWithSource[] = useMemo(() => {
    const rules = [...config.rules.map((rule) => ({ ...rule }))];
    addDefaultSystemMessage(rules, mode, config);
    return rules;
  }, [config, mode]);

  return (
    <div>
      {isLocal ? (
        <DropdownButton
          title="Rules"
          variant="sm"
          options={globalRulesOptions}
          onOptionClick={handleOptionClick}
          addButtonTooltip="Add rules"
        />
      ) : (
        <ConfigHeader
          title="Rules"
          subtext="System instructions applied in Chat, Agent, and Plan"
          variant="sm"
          onAddClick={() => handleAddRule()}
          addButtonTooltip="Add rules"
        />
      )}

      {sortedRules.length > 0 ? (
        <Card className="!p-0 overflow-hidden">
          <div className={CONFIG_HAIRLINE_DIVIDE}>
            {sortedRules.map((rule, index) => (
              <RuleCard key={index} rule={rule} />
            ))}
            {configLoading && (
              <div className="text-description px-4 py-2 text-xs">
                Reloading rules from your config...
              </div>
            )}
          </div>
        </Card>
      ) : (
        <ConfigEmptyAction
          status="No rules configured"
          actionLabel="Add rule"
          onClick={() => handleAddRule()}
        />
      )}
    </div>
  );
}

/**
 * Section listing skills auto-detected from the workspace and global folders,
 * with a way to scaffold a new one.
 */
function SkillsSubSection() {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const { skills, isLoading, refresh } = useSkills();

  const handleAddSkill = () => {
    dispatch(setShowDialog(true));
    dispatch(setDialogMessage(<AddSkillDialog onCreated={refresh} />));
  };

  const handleOpenSkill = (skill: DetectedSkill) => {
    if (skill.sourceFile) {
      void ideMessenger.ide.openFile(skill.sourceFile);
    }
  };

  return (
    <div>
      <ConfigHeader
        title="Skills"
        subtext="Task playbooks the agent loads on demand, detected from your workspace"
        variant="sm"
        onAddClick={handleAddSkill}
        addButtonTooltip="Add skill"
      />

      {skills.length > 0 ? (
        <Card className="!p-0 overflow-hidden">
          <div className={CONFIG_HAIRLINE_DIVIDE}>
            {skills.map((skill) => (
              <div
                key={`${skill.scope}:${skill.name}`}
                className="hover:bg-list-active hover:text-list-active-foreground flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 transition-colors"
                onClick={() => handleOpenSkill(skill)}
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {skill.name}
                    </span>
                    <span className="text-description text-2xs shrink-0 rounded border border-solid border-[color:var(--vscode-sideBar-border,rgba(128,128,128,0.22))] px-1 py-px uppercase leading-none tracking-wide">
                      {skill.scope}
                    </span>
                  </div>
                  <span className="text-description line-clamp-2 text-xs leading-snug">
                    {skill.description}
                  </span>
                  <span className="text-description text-2xs truncate opacity-80">
                    {skill.displayPath}
                  </span>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  <HeaderButtonWithToolTip
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenSkill(skill);
                    }}
                    text="Open file"
                  >
                    <ArrowTopRightOnSquareIcon className="text-description h-3 w-3" />
                  </HeaderButtonWithToolTip>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : isLoading ? (
        <div className="text-description px-1 text-xs">Looking for skills…</div>
      ) : (
        <>
          <ConfigEmptyAction
            status="No skills detected"
            actionLabel="Add skill"
            onClick={handleAddSkill}
          />
          <p className="text-description mt-2 text-xs leading-snug">
            Add a <code className="text-2xs">SKILL.md</code> under{" "}
            <code className="text-2xs">.agents/skills/&lt;name&gt;/</code> or{" "}
            <code className="text-2xs">.claude/skills/</code>. Each skill needs a
            name and a description — the agent reads it on demand when the
            description matches your task.
          </p>
        </>
      )}
    </div>
  );
}

export function RulesSection() {
  return (
    <div className={CONFIG_PAGE_GAP}>
      <ConfigHeader
        title="Rules"
        subtext="Control agent behavior with system instructions, skills, and prompts"
        showAddButton={false}
      />

      <div className={CONFIG_PAGE_GAP}>
        <RulesSubSection />
        <SkillsSubSection />
        <PromptsSubSection />
      </div>
    </div>
  );
}
