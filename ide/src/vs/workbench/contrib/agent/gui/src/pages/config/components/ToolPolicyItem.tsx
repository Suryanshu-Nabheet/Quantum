import { ToolPolicy } from "terminal-security";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { Tool } from "core";
import { BUILT_IN_GROUP_NAME } from "core/tools/builtIn";
import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { ToolTip } from "../../../components/gui/Tooltip";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "../../../components/ui";
import { useFontSize } from "../../../components/ui/font";
import { cn } from "../../../util/cn";
import { useAppSelector } from "../../../redux/hooks";
import { addTool, setToolPolicy } from "../../../redux/slices/uiSlice";

interface ToolPolicyItemProps {
  tool: Tool;
  duplicatesDetected: boolean;
  isGroupEnabled: boolean;
  compact?: boolean;
}

function policyLabel(policy: ToolPolicy, disabled: boolean): string {
  if (disabled || policy === "disabled") {
    return "Excluded";
  }
  if (policy === "allowedWithoutPermission") {
    return "Automatic";
  }
  return "Ask first";
}

export function ToolPolicyItem(props: ToolPolicyItemProps) {
  const dispatch = useDispatch();
  const policy = useAppSelector(
    (state) => state.ui.toolSettings[props.tool.function.name],
  );
  const [isExpanded, setIsExpanded] = useState(false);
  const mode = useAppSelector((state) => state.session.mode);

  useEffect(() => {
    if (!policy) {
      dispatch(addTool(props.tool));
    }
  }, [props.tool.function.name, policy]);

  const parameters = useMemo(() => {
    if (props.tool.function.parameters?.properties) {
      return Object.entries(props.tool.function.parameters.properties).map(
        ([name, schema]) =>
          [name, schema] as [string, { description: string; type: string }],
      );
    }
    return undefined;
  }, [props.tool.function.parameters]);

  const fontSize = useFontSize(-2);

  const disabled =
    !props.isGroupEnabled ||
    (mode === "plan" &&
      props.tool.group === BUILT_IN_GROUP_NAME &&
      !props.tool.readonly);

  if (!policy) {
    return null;
  }

  const effectivePolicy: ToolPolicy =
    disabled || policy === "disabled" ? "disabled" : policy;

  const toolName =
    props.tool.originalFunctionName ?? props.tool.function.name;

  const policyControl = (
    <Listbox
      value={effectivePolicy}
      onChange={(newPolicy) => {
        if (!disabled && newPolicy !== policy) {
          dispatch(
            setToolPolicy({
              toolName: props.tool.function.name,
              policy: newPolicy as ToolPolicy,
            }),
          );
        }
      }}
      disabled={disabled}
    >
      <div className="relative w-[6.5rem] shrink-0">
        <ListboxButton
          className={cn(
            "border-[color:var(--vscode-sideBar-border,rgba(128,128,128,0.22))] h-7 w-full justify-between px-2",
            disabled && "cursor-not-allowed opacity-50",
          )}
          data-testid={`tool-policy-item-${props.tool.function.name}`}
        >
          <span className="text-2xs truncate">
            {policyLabel(effectivePolicy, disabled)}
          </span>
          <ChevronDownIcon className="h-3 w-3 shrink-0" />
        </ListboxButton>
        {!disabled && (
          <ListboxOptions className="!min-w-[6.5rem]">
            <ListboxOption value="allowedWithoutPermission">
              Automatic
            </ListboxOption>
            <ListboxOption value="allowedWithPermission">Ask first</ListboxOption>
            <ListboxOption value="disabled">Excluded</ListboxOption>
          </ListboxOptions>
        )}
      </div>
    </Listbox>
  );

  if (props.compact) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {props.duplicatesDetected ? (
              <ToolTip
                place="bottom"
                content={`Duplicate tool name ${props.tool.function.name} detected. Permissions may conflict across servers.`}
              >
                <InformationCircleIcon className="h-3.5 w-3.5 shrink-0 cursor-help text-yellow-500" />
              </ToolTip>
            ) : null}
            {props.tool.faviconUrl && (
              <img
                src={props.tool.faviconUrl}
                alt={props.tool.displayTitle}
                className="h-3.5 w-3.5 shrink-0"
              />
            )}
            <span className="text-sm font-medium">{toolName}</span>
          </div>
          <p className="text-description mt-0.5 line-clamp-2 text-xs leading-snug">
            {props.tool.function.description}
          </p>
        </div>
        {policyControl}
      </div>
    );
  }

  return (
    <div
      className="flex flex-col"
      style={{
        fontSize,
      }}
    >
      <div className="hover:bg-[rgba(128,128,128,0.08)] flex flex-col rounded px-2 py-2">
        <div className="flex flex-row items-start justify-between gap-3">
          <div
            className="flex min-w-0 flex-1 cursor-pointer flex-row items-start gap-1.5"
            onClick={() => setIsExpanded((val) => !val)}
          >
            <ChevronRightIcon
              className={cn(
                "xs:flex hidden h-3 w-3 shrink-0 pt-1 transition-all duration-200",
                isExpanded ? "rotate-90" : "",
              )}
            />

            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex items-center gap-1">
                {props.duplicatesDetected ? (
                  <ToolTip
                    place="bottom"
                    className="flex flex-wrap items-center"
                    content={`Duplicate tool name ${props.tool.function.name} detected. Permissions will conflict and usage may be unpredictable`}
                  >
                    <InformationCircleIcon className="h-3 w-3 shrink-0 cursor-help text-yellow-500" />
                  </ToolTip>
                ) : null}
                {props.tool.faviconUrl && (
                  <img
                    src={props.tool.faviconUrl}
                    alt={props.tool.displayTitle}
                    className="h-3 w-3 shrink-0"
                  />
                )}
                <span className="line-clamp-1 break-all text-sm">
                  {toolName}
                </span>
              </div>
              <div className="text-description line-clamp-2 text-xs">
                {props.tool.function.description}
              </div>
            </div>
          </div>

          {policyControl}
        </div>
      </div>
      <div
        className={cn(
          "flex flex-col overflow-hidden pl-2 transition-all",
          isExpanded ? "h-min" : "h-0 opacity-0",
          "gap-x-1 gap-y-2",
        )}
      >
        <span className="text-2xs mt-1.5 font-bold">Description:</span>
        <span className="text-2xs italic">
          {props.tool.function.description}
        </span>
        {parameters ? (
          <>
            <span className="text-2xs font-bold">Arguments:</span>
            {parameters.map((param, idx) => (
              <div key={idx} className="text-2xs block">
                <code>{param[0]}</code>
                <span className="ml-1">{`(${param[1].type ?? "unknown"}):`}</span>
                <span className="ml-1 italic">
                  {param[1].description ?? "No description"}
                </span>
              </div>
            ))}
          </>
        ) : null}
        <div className="h-1" />
      </div>
    </div>
  );
}
