import { PlusIcon } from "@heroicons/react/24/outline";
import { Button } from "../../../components/ui";
import { cn } from "../../../util/cn";
import {
  CONFIG_PAGE_SUBTITLE,
  CONFIG_PAGE_TITLE,
  CONFIG_GROUP_DESC,
  CONFIG_GROUP_TITLE,
} from "../configLayout";

interface ConfigHeaderProps {
  title: string;
  subtext?: string;
  onAddClick?: () => void;
  addButtonTooltip?: string;
  addButtonLabel?: string;
  className?: string;
  variant?: "default" | "sm";
  showAddButton?: boolean;
}

export function ConfigHeader({
  title,
  subtext,
  onAddClick,
  addButtonTooltip = "Add item",
  addButtonLabel = "Add",
  className = "",
  variant = "default",
  showAddButton = true,
}: ConfigHeaderProps) {
  const isSmall = variant === "sm";
  const marginBottom = isSmall ? "mb-2.5" : "";
  const titleClassName = isSmall ? CONFIG_GROUP_TITLE : CONFIG_PAGE_TITLE;
  const subtextClassName = isSmall ? CONFIG_GROUP_DESC : CONFIG_PAGE_SUBTITLE;
  const HeadingTag = isSmall ? "p" : "h2";

  return (
    <div
      className={cn(
        `${marginBottom} flex items-start justify-between gap-4`,
        className,
      )}
    >
      <div className="flex min-w-0 flex-col">
        <HeadingTag className={cn("my-0", titleClassName)}>{title}</HeadingTag>
        {subtext && <p className={cn("my-0", subtextClassName)}>{subtext}</p>}
      </div>
      {showAddButton && onAddClick && (
        <Button
          onClick={onAddClick}
          variant="outline"
          size={isSmall ? "sm" : "lg"}
          className="!my-0 inline-flex shrink-0 items-center gap-1.5"
          tooltip={addButtonTooltip}
        >
          <PlusIcon className={isSmall ? "h-3 w-3" : "h-3.5 w-3.5"} />
          <span>{addButtonLabel}</span>
        </Button>
      )}
    </div>
  );
}
