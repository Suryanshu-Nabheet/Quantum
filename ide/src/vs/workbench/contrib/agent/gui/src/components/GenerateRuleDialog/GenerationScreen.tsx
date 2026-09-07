import {
  getRuleType,
  RuleType,
  RuleTypeDescriptions,
} from "agent-config";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { CreateRuleBlockArgs } from "core/tools/implementations/createRuleBlock";
import { useContext, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import Spinner from "../gui/Spinner";
import { ToolTip } from "../gui/Tooltip";
import { Button } from "../ui";
import { useRuleGeneration } from "./useRuleGeneration";

interface GenerationScreenProps {
  inputPrompt: string;
  onBack: () => void;
  onSuccess: () => void;
  isManualMode?: boolean;
}

export function GenerationScreen({
  inputPrompt,
  onBack,
  onSuccess,
  isManualMode = false,
}: GenerationScreenProps) {
  const ideMessenger = useContext(IdeMessengerContext);

  const { register, watch, setValue, reset } = useForm<CreateRuleBlockArgs>({
    defaultValues: {
      name: "",
      description: "",
      globs: "",
      alwaysApply: undefined,
      rule: "",
    },
  });

  const formData = watch();

  // Track rule type separately from form data
  const [selectedRuleType, setSelectedRuleType] = useState<RuleType>(
    RuleType.Always,
  );
  const [formError, setFormError] = useState<string | null>(null);

  // Use the generation hook with the input prompt
  const { generateRule, isGenerating, error } = useRuleGeneration(
    inputPrompt,
    (args) => {
      // Streaming causes a lot of jank, so wait until done generating
      if (!isGenerating) {
        reset(args);
        handleRuleTypeChange(getRuleType(args));
      }
    },
  );

  // Start generation once when component mounts (only if not in manual mode)
  useEffect(() => {
    if (!isManualMode) {
      void generateRule();
    }
  }, [isManualMode]);

  const handleRuleTypeChange = (newRuleType: RuleType) => {
    setSelectedRuleType(newRuleType);

    // Update alwaysApply based on rule type
    const alwaysApply = newRuleType === RuleType.Always;
    setValue("alwaysApply", alwaysApply);

    // Don't clear optional fields - preserve their state
    // Users can manually clear them if needed
  };

  const handleCreateRule = async () => {
    // Clear any previous errors
    setFormError(null);

    if (!formData.name) {
      setFormError("Rule name is required");
      return;
    }

    if (!formData.rule) {
      setFormError("Rule content is required");
      return;
    }

    try {
      ideMessenger.post("config/addRule", {
        name: formData.name,
        content: formData.rule,
        description: formData.description || undefined,
        globs: Array.isArray(formData.globs)
          ? formData.globs.join(", ")
          : formData.globs || undefined,
        alwaysApply: formData.alwaysApply,
      });
      onSuccess();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      setFormError(`Failed to create rule: ${errorMessage}`);
    }
  };

  const showNameSpinner = isGenerating && !formData.name && !isManualMode;

  return (
    <div className="px-2 pb-2 pt-4 sm:px-4">
      <div>
        <div className="text-center">
          <h2 className="mb-0">Your rule</h2>
          <p className="text-description m-0 mt-2 p-0">
            Review and edit your generated rule below
          </p>
        </div>
        <div className="mt-5">
          <div className="flex flex-col gap-4">
            {/* Rule metadata form */}
            <div className="space-y-4">
              {/* Rule Name - Always visible */}
              <div className="space-y-1">
                <label className="text-foreground text-sm font-medium">
                  Rule Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    className="border-[color:var(--vscode-sideBar-border,rgba(128,128,128,0.22))] bg-input text-input-foreground placeholder:text-input-placeholder focus:border-border-focus box-border w-full rounded-md border px-3 py-2 text-xs focus:outline-none"
                    placeholder={showNameSpinner ? "" : "Enter rule name..."}
                    disabled={isGenerating && !isManualMode}
                    {...register("name")}
                  />
                  {showNameSpinner && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                      <Spinner />
                    </div>
                  )}
                </div>
              </div>

              {/* Rule Type Selector - Always visible */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <label className="text-foreground text-sm font-medium">
                    Rule Type
                  </label>
                  <ToolTip
                    style={{ zIndex: 100001 }}
                    content={RuleTypeDescriptions[selectedRuleType]}
                  >
                    <InformationCircleIcon className="h-4 w-4 text-gray-500" />
                  </ToolTip>
                </div>
                <div className="relative">
                  <select
                    className="border-[color:var(--vscode-sideBar-border,rgba(128,128,128,0.22))] bg-input text-input-foreground focus:border-border-focus w-full rounded-md border px-3 py-2 text-xs focus:outline-none"
                    value={isGenerating ? "" : selectedRuleType}
                    onChange={(e) =>
                      handleRuleTypeChange(e.target.value as RuleType)
                    }
                    disabled={isGenerating && !isManualMode}
                  >
                    {isGenerating && !isManualMode ? (
                      <option value=""></option>
                    ) : (
                      <>
                        <option value={RuleType.Always}>Always</option>
                        <option value={RuleType.AutoAttached}>
                          Auto Attached
                        </option>
                        <option value={RuleType.AgentRequested}>
                          Agent Requested
                        </option>
                        <option value={RuleType.Manual}>Manual</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Description (for Agent Requested only) */}
              <div
                className={`space-y-1 ${selectedRuleType === RuleType.AgentRequested ? "" : "hidden"}`}
              >
                <label className="text-foreground text-sm font-medium">
                  Description
                </label>
                <textarea
                  className="border-[color:var(--vscode-sideBar-border,rgba(128,128,128,0.22))] bg-input text-input-foreground placeholder:text-input-placeholder focus:border-border-focus box-border w-full resize-none rounded-md border px-3 py-2 text-xs focus:outline-none"
                  rows={3}
                  placeholder="Description of the task this rule is helpful for..."
                  {...register("description")}
                />
              </div>

              {/* File Pattern (for Auto Attached only) */}
              <div
                className={`space-y-1 ${selectedRuleType === RuleType.AutoAttached ? "" : "hidden"}`}
              >
                <label className="text-foreground text-sm font-medium">
                  File pattern matches
                </label>
                <input
                  type="text"
                  className="border-[color:var(--vscode-sideBar-border,rgba(128,128,128,0.22))] bg-input text-input-foreground placeholder:text-input-placeholder focus:border-border-focus box-border w-full rounded-md border px-3 py-2 font-mono text-xs focus:outline-none"
                  placeholder="*.tsx, **/*.{ts,tsx}, tests/**/*.ts ..."
                  {...register("globs")}
                />
              </div>
            </div>

            {/* Rule Content */}
            <div className="relative">
              <label className="text-foreground text-sm font-medium">
                Rule Content
              </label>
              <textarea
                className="border-[color:var(--vscode-sideBar-border,rgba(128,128,128,0.22))] bg-input text-input-foreground placeholder:text-input-placeholder focus:border-border-focus mt-1 box-border w-full resize-none rounded border p-2 text-xs focus:outline-none"
                rows={10}
                disabled={isGenerating && !isManualMode}
                placeholder="Your rule content..."
                {...register("rule")}
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="my-4 flex flex-col items-center gap-2">
              <div className="flex flex-row justify-center gap-3">
                <Button
                  type="button"
                  className="min-w-16"
                  onClick={onBack}
                  variant="outline"
                  disabled={isGenerating && !isManualMode}
                >
                  Back
                </Button>
                <Button
                  className="min-w-16"
                  onClick={handleCreateRule}
                  disabled={
                    (isGenerating && !isManualMode) ||
                    (!formData.rule && !error) ||
                    !formData.name
                  }
                >
                  Create rule
                </Button>
              </div>
              {formError && (
                <span className="text-error text-center text-xs">
                  Error creating rule: {formError}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
