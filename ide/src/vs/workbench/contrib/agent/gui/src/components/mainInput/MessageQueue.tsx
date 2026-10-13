import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { removeQueuedMessage } from "../../redux/slices/sessionSlice";

export function MessageQueue() {
  const dispatch = useAppDispatch();
  const queue = useAppSelector((state) => state.session.messageQueue ?? []);
  const [open, setOpen] = useState(true);

  if (queue.length === 0) {
    return null;
  }

  const label = queue.length === 1 ? "1 in queue" : `${queue.length} in queue`;

  return (
    <div className="border-command-border border-b border-solid">
      <button
        type="button"
        className="text-description flex w-full cursor-pointer appearance-none items-center gap-1.5 border-none bg-transparent px-2 py-1.5 text-left shadow-none"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? (
          <ChevronDownIcon className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRightIcon className="h-3 w-3 shrink-0" />
        )}
        <span>{label}</span>
      </button>
      {open && (
        <ul className="m-0 list-none px-2 pb-1.5">
          {queue.map((item) => (
            <li key={item.id} className="flex min-w-0 items-start gap-2 py-1">
              <span
                className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: "var(--vscode-textLink-foreground, #519aba)" }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 break-words leading-4">
                {item.preview}
              </span>
              <button
                type="button"
                className="shrink-0 cursor-pointer appearance-none border-none bg-transparent px-1 text-[11px] leading-4 shadow-none hover:underline"
                style={{ color: "var(--vscode-textLink-foreground, #519aba)" }}
                aria-label={`Remove queued message: ${item.preview}`}
                onClick={() => dispatch(removeQueuedMessage(item.id))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
