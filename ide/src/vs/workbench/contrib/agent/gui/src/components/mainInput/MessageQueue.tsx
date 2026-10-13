import { ChevronDownIcon, ChevronRightIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { removeQueuedMessage } from "../../redux/slices/sessionSlice";
import { sendQueuedNow } from "../../redux/thunks/sendQueuedNow";

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
        <ul className="thin-scrollbar m-0 max-h-40 list-none overflow-y-auto overscroll-contain px-2 pb-1.5">
          {queue.map((item) => (
            <li key={item.id} className="flex min-w-0 items-start gap-2 py-1">
              <span className="thin-scrollbar max-h-16 min-w-0 flex-1 overflow-y-auto overscroll-contain break-words leading-4 [overflow-wrap:anywhere]">
                {item.preview}
              </span>
              <button
                type="button"
                className="sticky top-1 shrink-0 cursor-pointer appearance-none border-none bg-transparent px-1 text-[11px] leading-4 shadow-none hover:underline"
                style={{ color: "var(--vscode-textLink-foreground, #519aba)" }}
                onClick={() => void dispatch(sendQueuedNow(item.id))}
              >
                Send now
              </button>
              <button
                type="button"
                className="text-description sticky top-1 flex h-4 w-4 shrink-0 cursor-pointer appearance-none items-center justify-center border-none bg-transparent p-0 shadow-none"
                aria-label={`Remove queued message: ${item.preview}`}
                onClick={() => dispatch(removeQueuedMessage(item.id))}
              >
                <XMarkIcon className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
