import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { cn } from "../../../util/cn";
import { ToolTip } from "../../../components/gui/Tooltip";
import {
  CONFIG_NAV_ICON_CLASS,
  CONFIG_NAV_ROW_HEIGHT,
} from "../configLayout";

interface ConfigSidebarCellProps {
  label: string;
  icon: React.ReactNode;
  isActive?: boolean;
  external?: boolean;
  onClick: () => void;
  tabId?: string;
}

const ICON_SLOT = cn(
  "flex flex-shrink-0 items-center justify-center",
  CONFIG_NAV_ICON_CLASS,
  "[&_svg]:block [&_svg]:h-full [&_svg]:w-full",
);

export function ConfigSidebarCell({
  label,
  icon,
  isActive = false,
  external = false,
  onClick,
  tabId,
}: ConfigSidebarCellProps) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  const cell = (
    <div
      role="button"
      tabIndex={0}
      data-testid={tabId ? `tab-${tabId}` : undefined}
      aria-current={isActive ? "page" : undefined}
      aria-label={label}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "box-border flex w-full cursor-pointer items-center rounded-md border-0 text-left text-[13px] leading-none transition-colors",
        CONFIG_NAV_ROW_HEIGHT,
        "justify-center gap-0 px-0 xl:justify-start xl:gap-2.5 xl:px-2",
        "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-border-focus",
        isActive
          ? "bg-vsc-input-background text-foreground"
          : "text-description hover:bg-list-hover hover:text-foreground",
      )}
    >
      <span
        className={cn(
          ICON_SLOT,
          isActive ? "text-foreground" : "text-description",
        )}
      >
        {icon}
      </span>
      <span className="hidden min-w-0 flex-1 truncate whitespace-nowrap xl:block">
        {label}
      </span>
      {external && (
        <span
          className={cn(
            "text-description ml-auto hidden h-3 w-3 flex-shrink-0 items-center justify-center opacity-50 xl:flex",
            "[&_svg]:h-full [&_svg]:w-full",
          )}
        >
          <ArrowTopRightOnSquareIcon />
        </span>
      )}
    </div>
  );

  // Tooltips when the rail is icon-only; still fine when expanded.
  return (
    <ToolTip content={label} place="right">
      {cell}
    </ToolTip>
  );
}
