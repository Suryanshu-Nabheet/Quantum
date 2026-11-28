import { CheckIcon, ClipboardIcon } from "@heroicons/react/24/outline";
import useCopy from "../../../hooks/useCopy";
import { ToolTip } from "../../gui/Tooltip";
import HoverItem from "../../mainInput/InputToolbar/HoverItem";

interface CopyButtonProps {
  text: string;
}

export function CopyButton({ text }: CopyButtonProps) {
  const { copyText, copied } = useCopy(text);

  return (
    <ToolTip place="top" content={copied ? "Copied" : "Copy Code"}>
      <HoverItem className="!p-0">
        <button
          type="button"
          aria-label={copied ? "Copied" : "Copy"}
          className="text-lightgray flex cursor-pointer items-center border-none bg-transparent p-0 text-xs hover:brightness-125 focus-visible:outline focus-visible:outline-1"
          onClick={copyText}
        >
          <div className="flex items-center gap-1 transition-colors duration-200 hover:brightness-125">
            {copied ? (
              <CheckIcon className="h-3.5 w-3.5 text-green-500 hover:brightness-125" />
            ) : (
              <ClipboardIcon className="h-3.5 w-3.5 hover:brightness-125" />
            )}
          </div>
        </button>
      </HoverItem>
    </ToolTip>
  );
}
