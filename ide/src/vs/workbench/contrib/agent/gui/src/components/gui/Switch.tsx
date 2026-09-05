import { InformationCircleIcon } from "@heroicons/react/24/outline";
import React, { ReactNode } from "react";
import { ToolTip } from "./Tooltip";

type ToggleSwitchProps = {
  isToggled: boolean;
  onToggle: () => void;
  text: string;
  size?: number;
  showIfToggled?: ReactNode;
  disabled?: boolean;
  tooltip?: string;
};

/**
 * Compact toggle. Critical colors use inline styles (not Tailwind arbitrary
 * classes) so off-state track/thumb always paint — JIT can miss new utilities
 * until a full CSS rebuild.
 */
const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  isToggled,
  onToggle,
  text,
  size = 16,
  showIfToggled,
  disabled = false,
  tooltip,
}) => {
  const trackHeight = Math.max(size, 14);
  const trackWidth = Math.round(trackHeight * 1.75);
  const pad = 2;
  const thumb = trackHeight - pad * 2;
  const travel = trackWidth - thumb - pad * 2;

  return (
    <div
      className={`flex select-none items-center justify-between gap-3 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      <span className="truncate-right flex items-center gap-x-1">
        {text}{" "}
        {tooltip && (
          <ToolTip content={tooltip}>
            <InformationCircleIcon className="h-3 w-3" />
          </ToolTip>
        )}
      </span>
      <div className="flex flex-row items-center gap-1">
        {isToggled && !!showIfToggled && showIfToggled}
        <div
          role="switch"
          aria-checked={isToggled}
          aria-disabled={disabled}
          className="relative overflow-hidden rounded-full"
          onClick={
            disabled
              ? undefined
              : (e) => {
                  e.stopPropagation();
                  onToggle();
                }
          }
          style={{
            height: trackHeight,
            width: trackWidth,
            backgroundColor: isToggled
              ? "var(--vscode-button-background, #4d8bf0)"
              : "color-mix(in srgb, var(--vscode-foreground, #cccccc) 22%, transparent)",
            boxShadow: isToggled
              ? "none"
              : "inset 0 0 0 1px color-mix(in srgb, var(--vscode-foreground, #cccccc) 40%, transparent)",
          }}
        >
          <div
            className="absolute rounded-full transition-transform duration-150 ease-out"
            style={{
              height: thumb,
              width: thumb,
              top: pad,
              left: pad,
              transform: isToggled
                ? `translateX(${travel}px)`
                : "translateX(0)",
              backgroundColor: isToggled
                ? "var(--vscode-button-foreground, #ffffff)"
                : "var(--vscode-foreground, #e0e0e0)",
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.35)",
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default ToggleSwitch;
