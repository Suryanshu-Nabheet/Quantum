import { useMemo } from "react";
import { BUILT_IN_GROUP_NAME } from "core/tools/builtIn";
import Alert from "../../../components/gui/Alert";
import { useAppSelector } from "../../../redux/hooks";
import { ConfigHeader } from "../components/ConfigHeader";
import { ToolPoliciesGroup } from "../components/ToolPoliciesGroup";
import { CONFIG_PAGE_GAP } from "../configLayout";

export function ToolsSection() {
  const availableTools = useAppSelector((state) => state.config.config.tools);

  const mode = useAppSelector((store) => store.session.mode);

  const duplicateDetection = useMemo(() => {
    const counts: Record<string, number> = {};
    availableTools.forEach((tool) => {
      if (counts[tool.function.name]) {
        counts[tool.function.name] = counts[tool.function.name] + 1;
      } else {
        counts[tool.function.name] = 1;
      }
    });
    return Object.fromEntries(
      Object.entries(counts).map(([k, v]) => [k, v > 1]),
    );
  }, [availableTools]);

  const allToolsOff = useMemo(() => {
    return mode === "chat";
  }, [mode]);

  const availableToolsMessage =
    mode === "chat"
      ? "All tools disabled in Chat — switch to Plan or Agent mode to use tools"
      : mode === "plan"
        ? "Read-only tools available in Plan mode"
        : "";

  return (
    <div className={CONFIG_PAGE_GAP}>
      <ConfigHeader
        title="Tools"
        subtext="Set each tool to Automatic, Ask first, or Excluded in Agent and Plan mode"
        showAddButton={false}
      />
      {!!availableToolsMessage && (
        <Alert type="info" size="sm">
          <span className="text-sm italic">{availableToolsMessage}</span>
        </Alert>
      )}
      <ToolPoliciesGroup
        variant="flat"
        showIcon={false}
        groupName={BUILT_IN_GROUP_NAME}
        displayName="Built-in tools"
        allToolsOff={allToolsOff}
        duplicateDetection={duplicateDetection}
      />
    </div>
  );
}
