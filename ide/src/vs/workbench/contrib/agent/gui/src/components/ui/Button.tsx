import * as React from "react";
import { cn } from "../../util/cn";
import { ToolTip } from "../gui/Tooltip";

type ButtonVariant = "ghost" | "primary" | "secondary" | "outline" | "icon";
type ButtonSize = "sm" | "lg";

type ButtonProps = React.ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Hover label (editor-style tooltip via ToolTip). */
  tooltip?: string;
};

const buttonVariants = {
  primary:
    "border-none text-primary-foreground bg-primary hover:enabled:brightness-125 active:enabled:scale-[0.98]",
  secondary:
    "border-none text-foreground bg-border hover:enabled:brightness-125 active:enabled:scale-[0.98]",
  outline:
    "border border-solid border-[color:var(--vscode-sideBar-border,rgba(128,128,128,0.22))] text-foreground bg-transparent hover:enabled:bg-input active:enabled:scale-[0.98]",
  ghost:
    "border-none text-foreground bg-inherit hover:enabled:brightness-125 hover:enabled:bg-input active:enabled:scale-[0.98]",
  icon: "border-none text-description bg-transparent hover:enabled:text-foreground hover:enabled:bg-input rounded-md p-0 flex items-center justify-center active:enabled:scale-[0.97]",
};

const buttonSizes = {
  sm: "px-1.5 py-0.5 text-2xs",
  lg: "px-2 py-1 text-sm",
};

const iconButtonSizes = {
  sm: "h-4 w-4",
  lg: "h-5 w-5",
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", size = "lg", className, tooltip, ...props },
    ref,
  ) => {
    const isIcon = variant === "icon";
    const button = (
      <button
        ref={ref}
        className={cn(
          "cursor-pointer transition-[transform,colors,opacity,filter] duration-150 ease-out",
          "hover:enabled:cursor-pointer",
          "disabled:cursor-not-allowed disabled:opacity-50",
          buttonVariants[variant],
          isIcon
            ? iconButtonSizes[size]
            : `my-1.5 rounded ${buttonSizes[size]}`,
          className,
        )}
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          ...props.style,
        }}
        {...props}
      />
    );

    if (tooltip) {
      return (
        <ToolTip content={tooltip} place="top">
          {button}
        </ToolTip>
      );
    }

    return button;
  },
);

Button.displayName = "Button";

export { Button };
