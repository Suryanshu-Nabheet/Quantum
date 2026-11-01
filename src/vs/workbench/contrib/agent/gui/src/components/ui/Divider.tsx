interface DividerProps {
  className?: string;
}

export function Divider({ className }: DividerProps) {
  return (
    <div
      className={`my-2 border-0 border-b border-solid border-b-[color:var(--vscode-sideBar-border,rgba(128,128,128,0.22))] ${className || ""}`}
    />
  );
}
