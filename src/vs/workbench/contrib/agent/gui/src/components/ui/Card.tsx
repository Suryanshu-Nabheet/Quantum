import { cn } from "../../util/cn";
import { HAIRLINE_BORDER } from "../../styles/borders";

interface CardProps extends React.ComponentProps<"div"> {
  children: React.ReactNode;
}

export function Card({ children, className = "", ...props }: CardProps) {
  return (
    <div
      {...props}
      className={cn(
        "bg-vsc-input-background rounded-default border border-solid space-y-0 px-4 py-3",
        HAIRLINE_BORDER,
        className,
      )}
    >
      {children}
    </div>
  );
}
