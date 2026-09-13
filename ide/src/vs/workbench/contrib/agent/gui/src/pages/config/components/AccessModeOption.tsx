import type { ReactNode } from "react";
import { cn } from "../../../util/cn";
import { Card } from "../../../components/ui";
import { ConfigHeader } from "./ConfigHeader";
import {
  CONFIG_CARD_STACK,
  CONFIG_HAIRLINE_DIVIDE,
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

/**
 * Same shell as Shortcuts / General rows: Card + hairline list.
 * Selection is only the radio fill — no row background tint.
 */
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
        "relative flex items-start gap-3 px-4 py-3",
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
        <span className="text-foreground block text-sm font-medium leading-5">
          {choice.title}
        </span>
        <span className="text-description mt-1 block text-xs leading-5">
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
    <div>
      <ConfigHeader
        title={title}
        subtext={description}
        variant="sm"
        showAddButton={false}
      />
      {disabled && disabledHint ? (
        <p className="text-description mb-3 mt-0 text-xs leading-5">
          {disabledHint}
        </p>
      ) : null}
      <Card className="!p-0 overflow-hidden">
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
      </Card>
    </div>
  );
}

export function AccessModeStack({ children }: { children: ReactNode }) {
  return <div className={CONFIG_CARD_STACK}>{children}</div>;
}
