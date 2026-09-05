import { getRuleType, RuleType, RuleTypeDescriptions } from "agent-config";
import { useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { Input, SecondaryButton } from "..";
import Switch from "../gui/Switch";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";

interface ExistingRule {
  ruleId: string;
  name: string;
  description?: string;
  content: string;
  globs?: string | string[];
  regex?: string | string[];
  alwaysApply?: boolean;
  invokable?: boolean;
}

function globsToString(globs?: string | string[]): string {
  if (!globs) {
    return "";
  }
  return Array.isArray(globs) ? globs.join(", ") : globs;
}

function inferRuleType(rule: ExistingRule): RuleType {
  return getRuleType({
    globs: rule.globs,
    regex: rule.regex,
    description: rule.description,
    alwaysApply: rule.alwaysApply,
  });
}

function AddRuleDialog({
  existingRule,
}: {
  mode?: "workspace" | "global";
  existingRule?: ExistingRule;
}) {
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const [name, setName] = useState(existingRule?.name ?? "new-rule");
  const [description, setDescription] = useState(
    existingRule?.description ?? "",
  );
  const [content, setContent] = useState(
    existingRule?.content ??
      "Describe how the agent should behave when this rule applies.",
  );
  const [globs, setGlobs] = useState(globsToString(existingRule?.globs));
  const [ruleType, setRuleType] = useState<RuleType>(
    existingRule ? inferRuleType(existingRule) : RuleType.Always,
  );
  const [invokable, setInvokable] = useState(existingRule?.invokable ?? false);
  const [error, setError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const alwaysApply = useMemo(() => {
    return ruleType === RuleType.Always;
  }, [ruleType]);

  useLayoutEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const closeDialog = () => {
    dispatch(setShowDialog(false));
    dispatch(setDialogMessage(undefined));
  };

  const buildPayload = () => {
    const trimmedGlobs = globs.trim();
    const payload: {
      name: string;
      content: string;
      description?: string;
      globs?: string;
      alwaysApply: boolean;
      invokable: boolean;
    } = {
      name: name.trim(),
      content: content.trim(),
      alwaysApply,
      invokable,
    };

    if (description.trim()) {
      payload.description = description.trim();
    }

    if (ruleType === RuleType.AutoAttached && trimmedGlobs) {
      payload.globs = trimmedGlobs;
    }

    if (
      ruleType === RuleType.AgentRequested &&
      !payload.description
    ) {
      return undefined;
    }

    return payload;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Rule name is required");
      return;
    }
    if (!content.trim()) {
      setError("Rule content is required");
      return;
    }
    if (ruleType === RuleType.AutoAttached && !globs.trim()) {
      setError("Glob pattern is required for file-scoped rules");
      return;
    }
    if (ruleType === RuleType.AgentRequested && !description.trim()) {
      setError("Description is required for agent-requested rules");
      return;
    }

    const payload = buildPayload();
    if (!payload) {
      setError("Description is required for agent-requested rules");
      return;
    }

    setError(undefined);
    setIsSubmitting(true);
    try {
      if (existingRule) {
        ideMessenger.post("config/updateRule", {
          ruleId: existingRule.ruleId,
          ...payload,
        });
      } else {
        ideMessenger.post("config/addRule", payload);
      }
      closeDialog();
    } catch {
      setIsSubmitting(false);
      setError("Failed to save rule");
    }
  };

  const title = existingRule ? "Edit rule" : "Add rule";

  return (
    <div className="px-2 pt-4 sm:px-4">
      <div>
        <h1 className="mb-0">{title}</h1>
        <p className="text-description m-0 mt-2 p-0 text-sm">
          Rules are stored in Quantum Settings.
        </p>
        <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3">
          <label className="flex w-full flex-col gap-1">
            <span className="text-sm font-medium">Rule name</span>
            <Input
              ref={inputRef}
              type="text"
              placeholder="ex: api-guidelines"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className="flex w-full flex-col gap-1">
            <span className="text-sm font-medium">Rule type</span>
            <select
              className="bg-input text-foreground w-full rounded border border-[color:var(--vscode-sideBar-border,rgba(128,128,128,0.22))] px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-border-focus"
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value as RuleType)}
            >
              {Object.values(RuleType).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <span className="text-description text-xs">
              {RuleTypeDescriptions[ruleType]}
            </span>
          </label>

          {(ruleType === RuleType.AgentRequested ||
            ruleType === RuleType.Manual) && (
            <label className="flex w-full flex-col gap-1">
              <span className="text-sm font-medium">Description</span>
              <Input
                type="text"
                placeholder="When should the agent use this rule?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
          )}

          {ruleType === RuleType.AutoAttached && (
            <label className="flex w-full flex-col gap-1">
              <span className="text-sm font-medium">File globs</span>
              <Input
                type="text"
                placeholder="**/*.{ts,tsx}"
                value={globs}
                onChange={(e) => setGlobs(e.target.value)}
              />
            </label>
          )}

          <label className="flex w-full flex-col gap-1">
            <span className="text-sm font-medium">Rule content</span>
            <textarea
              className="bg-input text-foreground min-h-[120px] w-full rounded border border-[color:var(--vscode-sideBar-border,rgba(128,128,128,0.22))] px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-border-focus"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </label>

          <label className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-sm font-medium">Invokable slash command</span>
              <span className="text-description text-xs">
                Expose as /{name.trim() || "rule-name"} in chat
              </span>
            </div>
            <Switch
              isToggled={invokable}
              onToggle={() => setInvokable(!invokable)}
              size={12}
              text=""
            />
          </label>

          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="mt-2 flex flex-row justify-end gap-2">
            <SecondaryButton
              className="min-w-16"
              disabled={isSubmitting}
              type="submit"
            >
              {existingRule ? "Save" : "Create"}
            </SecondaryButton>
            <SecondaryButton
              type="button"
              className="min-w-16"
              onClick={closeDialog}
            >
              Cancel
            </SecondaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddRuleDialog;
