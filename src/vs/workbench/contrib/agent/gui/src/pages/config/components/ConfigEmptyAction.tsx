import { PlusIcon } from "@heroicons/react/24/outline";
import { defaultBorderRadius } from "../../../components";

interface ConfigEmptyActionProps {
  status: string;
  actionLabel: string;
  onClick: () => void;
}

export function ConfigEmptyAction({
  status,
  actionLabel,
  onClick,
}: ConfigEmptyActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-vsc-input-background hover:bg-list-active hover:text-list-active-foreground text-vsc-foreground flex h-8 w-full cursor-pointer items-center justify-between border border-solid border-[color:var(--vscode-sideBar-border,rgba(128,128,128,0.22))] px-2.5 text-left transition-colors active:scale-[0.99]"
      style={{ borderRadius: defaultBorderRadius }}
    >
      <span className="text-description text-xs">{status}</span>
      <span className="text-description flex items-center gap-1 text-xs">
        <PlusIcon className="h-3 w-3" />
        {actionLabel}
      </span>
    </button>
  );
}
