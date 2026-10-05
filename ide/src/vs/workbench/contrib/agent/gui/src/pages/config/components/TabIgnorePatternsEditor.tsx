import { XMarkIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { Button } from "../../../components/ui";
import { cn } from "../../../util/cn";

const SUGGESTED_PATTERNS = [".env", ".env.*", "**/*.md", "**/secrets/**"];

const chipClass =
  "bg-vsc-input-background text-foreground border border-solid border-[color:var(--vscode-sideBar-border,rgba(128,128,128,0.22))]";

interface TabIgnorePatternsEditorProps {
  patterns: string[];
  onChange: (patterns: string[]) => void;
}

export function TabIgnorePatternsEditor({
  patterns,
  onChange,
}: TabIgnorePatternsEditorProps) {
  const [draft, setDraft] = useState("");

  function addPattern(raw: string) {
    const next = raw.trim();
    if (!next || patterns.includes(next)) {
      return;
    }
    onChange([...patterns, next]);
    setDraft("");
  }

  function removePattern(pattern: string) {
    onChange(patterns.filter((p) => p !== pattern));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-h-[1.25rem] flex-wrap gap-1.5">
        {patterns.length === 0 ? (
          <span className="text-description-muted text-xs leading-snug italic">
            None yet — Tab is allowed in all files (security exclusions still
            apply).
          </span>
        ) : (
          patterns.map((pattern) => (
            <span
              key={pattern}
              className={cn(
                chipClass,
                "inline-flex max-w-full items-center gap-1 rounded-md px-2 py-0.5 text-xs",
              )}
            >
              <span className="truncate font-mono">{pattern}</span>
              <button
                type="button"
                className={cn(
                  chipClass,
                  "text-description-muted hover:text-foreground -mr-0.5 rounded border-0 bg-transparent p-0.5",
                )}
                aria-label={`Remove ${pattern}`}
                onClick={() => removePattern(pattern)}
              >
                <XMarkIcon className="h-3.5 w-3.5" />
              </button>
            </span>
          ))
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <input
          type="text"
          value={draft}
          placeholder="e.g. .env or **/*.sql"
          className={cn(
            chipClass,
            "placeholder-description-muted min-w-0 flex-1 rounded-md px-2.5 py-2 text-xs outline-none focus:border-[color:var(--vscode-focusBorder)]",
          )}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addPattern(draft);
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="my-0 shrink-0 px-3 py-2"
          disabled={!draft.trim()}
          onClick={() => addPattern(draft)}
        >
          Add pattern
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-description-muted text-2xs shrink-0">
          Quick add:
        </span>
        {SUGGESTED_PATTERNS.map((suggestion) => {
          const added = patterns.includes(suggestion);
          return (
            <button
              key={suggestion}
              type="button"
              disabled={added}
              className={cn(
                chipClass,
                "rounded-md px-2 py-0.5 font-mono text-2xs transition-colors",
                added
                  ? "cursor-not-allowed opacity-40"
                  : "hover:bg-list-hover cursor-pointer",
              )}
              onClick={() => addPattern(suggestion)}
            >
              {suggestion}
            </button>
          );
        })}
      </div>
    </div>
  );
}
