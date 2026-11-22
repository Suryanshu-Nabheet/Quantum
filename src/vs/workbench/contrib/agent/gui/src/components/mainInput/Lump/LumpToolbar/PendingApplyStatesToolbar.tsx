import { ApplyState } from "core";
import { useContext, useState } from "react";
import { diffLines } from "diff";
import { HostBridgeContext } from "../../../../context/HostBridge";
import { getUriPathBasename } from "core/util/uri";
import AcceptRejectDiffButtons from "../../../AcceptRejectDiffButtons";
import FileIcon from "../../../FileIcon";

interface PendingApplyStatesToolbarProps {
  pendingApplyStates: ApplyState[];
}

export function PendingApplyStatesToolbar({
  pendingApplyStates,
}: PendingApplyStatesToolbarProps) {
  const hostBridge = useContext(HostBridgeContext);
  const [expandedFile, setExpandedFile] = useState<string>();
  // Group apply states by filepath
  const applyStatesByFilepath = pendingApplyStates.reduce(
    (acc, state) => {
      const filepath = state.filepath || ""; // Use empty string as fallback
      if (!acc[filepath]) {
        acc[filepath] = [];
      }
      acc[filepath].push(state);
      return acc;
    },
    {} as Record<string, ApplyState[]>,
  );

  const fileCount = Object.keys(applyStatesByFilepath).length;

  return (
    <div className="flex flex-col gap-2">
      {fileCount > 1 && (
        <div className="flex justify-end">
          <AcceptRejectDiffButtons
            applyStates={pendingApplyStates}
            onAcceptOrReject={async () => {}}
          />
        </div>
      )}
      {Object.entries(applyStatesByFilepath).map(([filepath, states]) => (
        <div key={filepath} className="flex flex-col gap-1">
          <div className="flex justify-between gap-3">
            {filepath && (
              <button
                type="button"
                onClick={() => setExpandedFile(expandedFile === filepath ? undefined : filepath)}
                aria-expanded={expandedFile === filepath}
                className="flex min-w-0 max-w-[75%] items-center gap-1 truncate rounded px-1.5 py-0.5 text-xs"
                style={{
                  background: "var(--vscode-input-background)",
                  color: "var(--vscode-foreground)",
                }}
              >
                <FileIcon filename={filepath} height="18px" width="18px" />
                <span className="truncate">{getUriPathBasename(filepath)}</span>
              </button>
            )}
            <AcceptRejectDiffButtons
              applyStates={states}
              onAcceptOrReject={async () => {}}
            />
          </div>
          {expandedFile === filepath && states[states.length - 1]?.status === "review" && (
            <div className="max-h-64 overflow-auto rounded bg-editor text-xs">
              <button type="button" className="px-2 py-1 underline" onClick={() => hostBridge.post("showFile", { filepath })}>Open file</button>
              <pre className="whitespace-pre-wrap break-all p-2">{diffLines(states[states.length - 1].originalFileContent ?? "", states[states.length - 1].fileContent ?? "").map((part, index) => (
                <span key={index} style={{ color: part.added ? "var(--vscode-gitDecoration-addedResourceForeground)" : part.removed ? "var(--vscode-gitDecoration-deletedResourceForeground)" : undefined }}>{part.value}</span>
              ))}</pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
