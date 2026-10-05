import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { Divider } from "../../../components/ui";
import { HAIRLINE_BORDER } from "../../../styles/borders";
import { cn } from "../../../util/cn";

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
      className={cn(
        "bg-vsc-input-background rounded-default overflow-hidden border border-solid",
        HAIRLINE_BORDER,
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={cn(
          "bg-vsc-input-background text-description hover:bg-list-hover hover:text-foreground",
          "flex w-full items-center gap-2 border-0 px-4 py-2.5 text-left text-xs transition-colors",
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
          <div className="px-4 py-3">{children}</div>
        </>
      )}
    </div>
  );
}
