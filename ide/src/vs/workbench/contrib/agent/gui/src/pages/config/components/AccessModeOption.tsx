import type { ReactNode } from "react";
import { cn } from "../../../util/cn";
import { ConfigGroupHeader } from "./ConfigGroupHeader";
import { ConfigPanel } from "./ConfigPanel";
import {
  CONFIG_HAIRLINE_DIVIDE,
  CONFIG_ROW_DESC,
  CONFIG_ROW_TITLE,
} from "../configLayout";

export interface AccessModeChoice<T extends string> {
  value: T;
  title: string;
  description: string;
}

interface AccessModeOptionProps<T extends string> {
  choice: AccessModeChoice<T>;
  selected: boolean;
  onSelect: (value: T) => void;
  name: string;
  disabled?: boolean;
}

function AccessModeOption<T extends string>({
  choice,
  selected,
  onSelect,
  name,
  disabled = false,
}: AccessModeOptionProps<T>) {
  return (
    <label
      className={cn(
        "relative flex items-start gap-2.5 px-3 py-2.5 sm:px-4",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      )}
    >
      <input
        type="radio"
        name={name}
        value={choice.value}
        checked={selected}
        disabled={disabled}
        onChange={() => onSelect(choice.value)}
        className="absolute h-px w-px overflow-hidden whitespace-nowrap border-0 p-0"
        style={{ clip: "rect(0, 0, 0, 0)" }}
      />
      <span
        aria-hidden
        className="border-foreground mt-0.5 box-border flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2 border-solid bg-transparent"
        style={{ opacity: selected ? 1 : 0.4 }}
      >
        {selected ? (
          <span className="bg-foreground block h-1.5 w-1.5 rounded-full" />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block", CONFIG_ROW_TITLE)}>{choice.title}</span>
        <span className={cn("mt-0.5 block", CONFIG_ROW_DESC)}>
          {choice.description}
        </span>
      </span>
    </label>
  );
}

interface AccessModeGroupProps<T extends string> {
  title: string;
  description: string;
  name: string;
  value: T;
  choices: AccessModeChoice<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  disabledHint?: string;
}

/** One radio group — use inside {@link AccessModeStack} for a single bordered panel. */
export function AccessModeGroup<T extends string>({
  title,
  description,
  name,
  value,
  choices,
  onChange,
  disabled = false,
  disabledHint,
}: AccessModeGroupProps<T>) {
  return (
    <div className="flex flex-col">
      <div className="px-3 pb-1 pt-2.5 sm:px-4 sm:pt-3">
        <ConfigGroupHeader title={title} description={description} />
        {disabled && disabledHint ? (
          <p className="text-description m-0 mt-1.5 text-xs leading-snug">
            {disabledHint}
          </p>
        ) : null}
      </div>
      <div
        className={cn("flex flex-col", CONFIG_HAIRLINE_DIVIDE)}
        role="radiogroup"
        aria-label={title}
        aria-disabled={disabled || undefined}
      >
        {choices.map((choice) => (
          <AccessModeOption
            key={choice.value}
            name={name}
            choice={choice}
            selected={value === choice.value}
            onSelect={onChange}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

/** Multiple {@link AccessModeGroup} blocks in one settings panel. */
export function AccessModeStack({ children }: { children: ReactNode }) {
  return (
    <ConfigPanel variant="raw">
      <div className={cn("flex flex-col", CONFIG_HAIRLINE_DIVIDE)}>{children}</div>
    </ConfigPanel>
  );
}
