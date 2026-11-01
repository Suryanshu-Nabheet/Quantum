import { ReactNode } from "react";
import { cn } from "../../../util/cn";
import {
  CONFIG_PANEL_PADDED,
  CONFIG_PANEL_ROWS,
  CONFIG_PANEL_SURFACE,
} from "../configLayout";

interface ConfigPanelProps {
  children: ReactNode;
  className?: string;
  /** `list` = divided rows; `padded` = single inset block; `raw` = surface only (e.g. custom dividers). */
  variant?: "list" | "padded" | "raw";
}

export function ConfigPanel({
  children,
  className,
  variant = "list",
}: ConfigPanelProps) {
  if (variant === "padded") {
    return (
      <div className={cn(CONFIG_PANEL_SURFACE, CONFIG_PANEL_PADDED, className)}>
        {children}
      </div>
    );
  }

  if (variant === "raw") {
    return (
      <div className={cn(CONFIG_PANEL_SURFACE, className)}>{children}</div>
    );
  }

  return (
    <div className={cn(CONFIG_PANEL_SURFACE, className)}>
      <div className={CONFIG_PANEL_ROWS}>{children}</div>
    </div>
  );
}
