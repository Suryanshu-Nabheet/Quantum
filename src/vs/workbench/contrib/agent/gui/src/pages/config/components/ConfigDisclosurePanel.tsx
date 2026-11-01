import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { Divider } from "../../../components/ui";
import { cn } from "../../../util/cn";
import { CONFIG_PANEL_SURFACE } from "../configLayout";

interface ConfigDisclosurePanelProps {
  open: boolean;
  onToggle: () => void;
  label: string;
  expandedLabel?: string;
  children: React.ReactNode;
}

/** Disclosure header + body in one bordered panel (no gap between toggle and content). */
export function ConfigDisclosurePanel({
  open,
  onToggle,
  label,
  expandedLabel,
  children,
}: ConfigDisclosurePanelProps) {
  const title = open && expandedLabel ? expandedLabel : label;

  return (
    <div
      className={CONFIG_PANEL_SURFACE}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={cn(
          "bg-vsc-input-background text-description hover:bg-list-hover hover:text-foreground",
          "flex w-full items-center gap-2 border-0 px-3 py-2 text-left text-xs transition-colors sm:px-4",
        )}
      >
        <ChevronRightIcon
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-transform duration-150 ease-out",
            open && "rotate-90",
          )}
          aria-hidden
        />
        <span>{title}</span>
      </button>
      {open && (
        <>
          <Divider className="!my-0" />
          <div className="px-3 py-2.5 sm:px-4 sm:py-3">{children}</div>
        </>
      )}
    </div>
  );
}
