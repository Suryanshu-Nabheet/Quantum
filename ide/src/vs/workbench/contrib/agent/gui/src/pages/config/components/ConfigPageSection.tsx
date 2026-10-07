import { ReactNode } from "react";
import { cn } from "../../../util/cn";
import {
  CONFIG_SECTION_DESC,
  CONFIG_SECTION_TITLE,
} from "../configLayout";

interface ConfigPageSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/** Major block on a settings page — title sits above the card, never inside it. */
export function ConfigPageSection({
  title,
  description,
  children,
  className,
}: ConfigPageSectionProps) {
  return (
    <section className={cn("flex flex-col gap-2", className)}>
      <header className="min-w-0">
        <h3 className={CONFIG_SECTION_TITLE}>{title}</h3>
        {description ? (
          <p className={CONFIG_SECTION_DESC}>{description}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}
