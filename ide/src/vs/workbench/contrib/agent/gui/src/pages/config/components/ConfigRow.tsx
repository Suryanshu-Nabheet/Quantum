import React from "react";
import { Button } from "../../../components/ui/Button";
import { cn } from "../../../util/cn";

export interface ConfigRowProps {
  title: string;
  description: string;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  onClick?: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export function ConfigRow({
  title,
  description,
  icon: Icon,
  onClick,
  disabled = false,
  children,
  className = "",
}: ConfigRowProps) {
  const baseClasses =
    "flex min-h-[2.75rem] items-center justify-between rounded-md transition-colors px-4 py-2.5";
  const interactiveClasses = onClick
    ? "hover:bg-list-hover cursor-pointer"
    : "";
  const disabledClasses = disabled ? "opacity-50 cursor-not-allowed" : "";

  const handleClick = (event: React.MouseEvent) => {
    if (!disabled && onClick) {
      const target = event.target as HTMLElement;
      const isInteractiveChild = target.closest(
        'button, input, textarea, select, [role="button"], [role="switch"]',
      );

      if (
        !isInteractiveChild ||
        target.closest("[data-config-row]") === event.currentTarget
      ) {
        onClick();
      }
    }
  };

  if (onClick) {
    return (
      <Button
        variant="ghost"
        className={cn(
          baseClasses,
          interactiveClasses,
          disabledClasses,
          "!my-0 text-left active:enabled:scale-100",
          className,
        )}
        onClick={handleClick}
        disabled={disabled}
        data-config-row
      >
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <span className="text-sm font-medium leading-5">{title}</span>
          <p className="text-description mt-0.5 text-xs leading-snug">
            {description}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-3 self-center">
          {children}
          {Icon && <Icon className="h-3.5 w-3.5 flex-shrink-0 text-description" />}
        </div>
      </Button>
    );
  }

  return (
    <div
      className={cn(baseClasses, disabledClasses, className)}
      data-config-row
    >
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <span className="text-sm font-medium leading-5">{title}</span>
        <p className="text-description mt-0.5 text-xs leading-snug">
          {description}
        </p>
      </div>
      <div className="flex flex-shrink-0 items-center gap-3 self-center">
        {children}
        {Icon && <Icon className="h-3.5 w-3.5 flex-shrink-0 text-description" />}
      </div>
    </div>
  );
}
