import { cn } from "../../../util/cn";
import { CONFIG_PANEL_BORDER } from "../configLayout";

export interface SettingSegmentedOption<T extends string> {
  label: string;
  value: T;
}

interface SettingSegmentedControlProps<T extends string> {
  value: T;
  options: SettingSegmentedOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  ariaLabel: string;
}

export function SettingSegmentedControl<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
  ariaLabel,
}: SettingSegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex shrink-0 overflow-hidden rounded-md border border-solid",
        CONFIG_PANEL_BORDER,
        disabled && "pointer-events-none opacity-50",
      )}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-w-[3.25rem] border-0 px-2.5 py-1 text-[11px] font-medium leading-none transition-colors",
              index > 0 &&
                "border-0 border-l border-solid border-[color:var(--vscode-editorWidget-border,var(--vscode-sideBar-border,rgba(128,128,128,0.32)))]",
              selected
                ? "bg-foreground text-vsc-background"
                : "bg-vsc-input-background text-foreground hover:bg-list-hover",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
