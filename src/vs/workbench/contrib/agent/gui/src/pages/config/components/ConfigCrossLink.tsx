import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { cn } from "../../../util/cn";
import { CONFIG_PANEL_BORDER } from "../configLayout";

interface ConfigCrossLinkProps {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}

/** In-settings navigation CTA between related pages (Models ↔ Model roles). */
export function ConfigCrossLink({
  children,
  onClick,
  className,
}: ConfigCrossLinkProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "bg-vsc-input-background text-foreground hover:bg-list-hover",
        "flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border border-solid px-3 py-2.5 text-left text-[13px] transition-colors",
        CONFIG_PANEL_BORDER,
        className,
      )}
    >
      <span className="min-w-0 leading-snug">{children}</span>
      <ArrowRightIcon className="text-description h-4 w-4 flex-shrink-0" />
    </button>
  );
}
