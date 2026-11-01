import {
  ListboxButton as HLButton,
  ListboxOption as HLOption,
  ListboxOptions as HLOptions,
  Listbox,
} from "@headlessui/react";
import * as React from "react";
import { defaultBorderRadius } from "..";
import { HAIRLINE_BORDER } from "../../styles/borders";
import { cn } from "../../util/cn";
import { FontSizeModifier, useFontSize } from "./font";

type ListboxButtonProps = React.ComponentProps<typeof HLButton> & {
  fontSizeModifier?: FontSizeModifier;
};

const ListboxButton = React.forwardRef<HTMLButtonElement, ListboxButtonProps>(
  ({ fontSizeModifier = -3, ...props }, ref) => {
    const fontSize = useFontSize(fontSizeModifier);
    return (
      <HLButton
        ref={ref}
        {...props}
        className={cn(
          "bg-vsc-input-background text-vsc-foreground m-0 flex flex-1 cursor-pointer flex-row items-center gap-1 border border-solid px-1 py-0.5 text-left transition-colors duration-200",
          HAIRLINE_BORDER,
          props.className,
        )}
        style={{
          fontSize,
          borderRadius: defaultBorderRadius,
          ...props.style,
        }}
      />
    );
  },
);

type ListboxOptionsProps = React.ComponentProps<typeof HLOptions> & {
  fontSizeModifier?: FontSizeModifier;
  /** When true, menu width matches the listbox button (--button-width). */
  matchTriggerWidth?: boolean;
  /** Exact menu width in px (e.g. measured from the trigger). Avoids Tailwind width tokens fighting inline styles. */
  fixedWidthPx?: number;
  /** Pass false to render in-flow under the trigger (full-width of relative parent). */
  anchor?: React.ComponentProps<typeof HLOptions>["anchor"] | false;
};
const ListboxOptions = React.forwardRef<HTMLUListElement, ListboxOptionsProps>(
  (
    {
      fontSizeModifier = -3,
      matchTriggerWidth = false,
      fixedWidthPx,
      anchor = "bottom start",
      ...props
    },
    ref,
  ) => {
    const fontSize = useFontSize(fontSizeModifier);
    const resolvedAnchor = anchor === false ? undefined : anchor;
    const fixedWidthStyle =
      fixedWidthPx !== undefined && fixedWidthPx > 0
        ? {
            width: fixedWidthPx,
            minWidth: fixedWidthPx,
            maxWidth: fixedWidthPx,
          }
        : undefined;
    return (
      <HLOptions
        ref={ref}
        anchor={resolvedAnchor}
        {...props}
        className={cn(
          "bg-vsc-input-background flex flex-col overflow-auto border border-solid px-0 shadow-md",
          fixedWidthPx !== undefined && fixedWidthPx > 0
            ? "box-border"
            : matchTriggerWidth
              ? "w-[var(--button-width)] min-w-[var(--button-width)] max-w-[var(--button-width)]"
              : "w-max min-w-[160px] max-w-[400px]",
          HAIRLINE_BORDER,
          props.className,
        )}
        style={{
          fontSize,
          borderRadius: defaultBorderRadius,
          zIndex: 200000,
          ...fixedWidthStyle,
          ...props.style,
        }}
      />
    );
  },
);

type ListboxOptionProps = React.ComponentProps<typeof HLOption> & {
  fontSizeModifier?: FontSizeModifier;
};
const ListboxOption = React.forwardRef<HTMLLIElement, ListboxOptionProps>(
  ({ fontSizeModifier = -3, ...props }, ref) => {
    const fontSize = useFontSize(fontSizeModifier);
    return (
      <HLOption
        ref={ref}
        {...props}
        className={cn(
          "text-foreground flex select-none flex-row items-center justify-between px-2 py-1",
          props.disabled
            ? "opacity-50"
            : "background-transparent hover:bg-list-active hover:text-list-active-foreground cursor-pointer opacity-100",
          props.className,
        )}
        style={{
          fontSize,
          ...props.style,
        }}
      />
    );
  },
);

export { Listbox, ListboxButton, ListboxOption, ListboxOptions };
