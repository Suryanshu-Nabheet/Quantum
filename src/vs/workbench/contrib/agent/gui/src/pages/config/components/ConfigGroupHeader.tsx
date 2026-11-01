import { cn } from "../../../util/cn";
import {
  CONFIG_GROUP_DESC,
  CONFIG_GROUP_TITLE,
} from "../configLayout";

interface ConfigGroupHeaderProps {
  title: string;
  description?: string;
  className?: string;
}

/** Label inside a card — always smaller than {@link ConfigPageSection} titles. */
export function ConfigGroupHeader({
  title,
  description,
  className,
}: ConfigGroupHeaderProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className={CONFIG_GROUP_TITLE}>{title}</p>
      {description ? (
        <p className={CONFIG_GROUP_DESC}>{description}</p>
      ) : null}
    </div>
  );
}
