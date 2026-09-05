import {
  ChevronDownIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { Tool } from "core";
import { useMemo, useState } from "react";
import ToggleSwitch from "../../../components/gui/Switch";
import { ToolTip } from "../../../components/gui/Tooltip";
import { Card } from "../../../components/ui";
import { cn } from "../../../util/cn";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { toggleToolGroupSetting } from "../../../redux/slices/uiSlice";
import { CONFIG_HAIRLINE_DIVIDE } from "../configLayout";
import { ToolPolicyItem } from "./ToolPolicyItem";

interface ToolPoliciesGroupProps {
  showIcon: boolean;
  groupName: string;
  displayName: string;
  subtext?: string;
  allToolsOff: boolean;
  duplicateDetection: Record<string, boolean>;
  variant?: "collapsible" | "flat";
}

export function ToolPoliciesGroup({
  showIcon,
  groupName,
  displayName,
  subtext,
  allToolsOff,
  duplicateDetection,
  variant = "collapsible",
}: ToolPoliciesGroupProps) {
  const dispatch = useAppDispatch();
  const [isExpanded, setIsExpanded] = useState(variant === "flat");

  const availableTools = useAppSelector(
    (state) => state.config.config.tools as Tool[],
  );
  const tools = useMemo(() => {
    return availableTools.filter((t) => t.group === groupName);
  }, [availableTools, groupName]);

  const toolGroupSettings = useAppSelector(
    (state) => state.ui.toolGroupSettings,
  );
  const toolSettings = useAppSelector((state) => state.ui.toolSettings);
  const isGroupEnabled = useMemo(() => {
    return toolGroupSettings[groupName] !== "exclude";
  }, [toolGroupSettings, groupName]);

  const { enabledCount, totalCount } = useMemo(() => {
    const total = tools.length;
    const enabled = tools.filter(
      (tool) => toolSettings[tool.function.name] !== "disabled",
    ).length;
    return { enabledCount: enabled, totalCount: total };
  }, [tools, toolSettings]);

  const badgeText = useMemo(() => {
    if (enabledCount === totalCount) {
      return totalCount.toString();
    }
    return `${enabledCount}/${totalCount}`;
  }, [enabledCount, totalCount]);

  const isFlat = variant === "flat";
  const showTools = isFlat || isExpanded;

  const groupToggle = (
    <ToolTip
      content={
        allToolsOff
          ? "Tools disabled in current mode"
          : isGroupEnabled
            ? `Disable all tools in ${displayName}`
            : `Enable all tools in ${displayName}`
      }
    >
      <div>
        <ToggleSwitch
          isToggled={isGroupEnabled}
          onToggle={() => dispatch(toggleToolGroupSetting(groupName))}
          text=""
          size={10}
          disabled={allToolsOff}
        />
      </div>
    </ToolTip>
  );

  if (isFlat) {
    return (
      <Card className="flex flex-col overflow-hidden p-0">
        <div className={cn("flex flex-col", CONFIG_HAIRLINE_DIVIDE)}>
          <div className="flex items-center justify-between gap-3 px-4 py-2">
            <span className="text-description text-xs">
              {enabledCount} of {totalCount} tools enabled
            </span>
            {groupToggle}
          </div>

          {tools.map((tool) => (
            <ToolPolicyItem
              key={tool.uri + tool.function.name}
              tool={tool}
              duplicatesDetected={duplicateDetection[tool.function.name]}
              isGroupEnabled={isGroupEnabled}
              compact
            />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-1 flex-col p-0">
      <div
        className="hover:bg-[rgba(128,128,128,0.08)] flex cursor-pointer items-center justify-between gap-3 rounded px-2 py-2"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <ChevronDownIcon
            className={cn(
              "text-description h-3 w-3 transition-transform",
              isExpanded ? "rotate-180" : "",
            )}
          />
          <div className="flex items-center gap-2">
            {showIcon && (
              <WrenchScrewdriverIcon className="h-4 w-4 flex-shrink-0" />
            )}
            <span className="text-sm font-semibold">{displayName}</span>
            <div className="bg-input flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium">
              {badgeText}
            </div>
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>{groupToggle}</div>
      </div>

      {showTools && (
        <div className="mt-1 space-y-1 pl-2">
          {tools.map((tool) => (
            <ToolPolicyItem
              key={tool.uri + tool.function.name}
              tool={tool}
              duplicatesDetected={duplicateDetection[tool.function.name]}
              isGroupEnabled={isGroupEnabled}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
