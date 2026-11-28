import { CommandLineIcon } from "@heroicons/react/24/outline";
import { useContext } from "react";
import { lightGray } from "../..";
import { HostBridgeContext } from "../../../context/HostBridge";
import { extractCommand } from "../utils/commandExtractor";

interface RunInTerminalButtonProps {
  command: string;
}

export function RunInTerminalButton({ command }: RunInTerminalButtonProps) {
  const hostBridge = useContext(HostBridgeContext);

  function runInTerminal() {
    // Extract just the command line
    const extractedCommand = extractCommand(command);
    void hostBridge.post("runCommand", { command: extractedCommand });
  }

  return (
    <button
      type="button"
      aria-label="Run in terminal"
      className="text-lightgray flex cursor-pointer items-center border-none bg-transparent p-0 text-xs hover:brightness-125 focus-visible:outline focus-visible:outline-1"
      onClick={runInTerminal}
    >
      <div
        className="max-2xs:hidden flex items-center gap-1 transition-colors duration-200 hover:brightness-125"
        style={{ color: lightGray }}
      >
        <>
          <CommandLineIcon className="h-3 w-3 hover:brightness-125" />
          <span className="text-lightgray max-sm:hidden">Run</span>
        </>
      </div>
    </button>
  );
}
