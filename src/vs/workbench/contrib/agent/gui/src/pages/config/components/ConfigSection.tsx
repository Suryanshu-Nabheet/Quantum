import { cn } from "../../../util/cn";
import { CONFIG_PAGE_GAP } from "../configLayout";

interface ConfigSectionProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function ConfigSection({
  title,
  children,
  className = "",
}: ConfigSectionProps) {
  return (
    <div className={cn("animate-in fade-in duration-200", CONFIG_PAGE_GAP, className)}>
      {title && (
        <h3 className="text-lg font-semibold leading-tight tracking-tight">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
