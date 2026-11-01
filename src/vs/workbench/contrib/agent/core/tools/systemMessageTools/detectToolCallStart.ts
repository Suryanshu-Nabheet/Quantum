import { SystemMessageToolsFramework } from "./types";

export function detectToolCallStart(
  buffer: string,
  toolCallFramework: SystemMessageToolsFramework,
) {
  const starts = toolCallFramework.acceptedToolCallStarts;
  let modifiedBuffer = buffer;
  let isInToolCall = false;
  let isInPartialStart = false;
  const lowerCaseBuffer = buffer.toLowerCase();
  for (let i = 0; i < starts.length; i++) {
    const [start, replacement] = starts[i];
    if (lowerCaseBuffer.startsWith(start)) {
      // Normalize only non-canonical formats. Canonical fences are allowed to
      // preserve their original casing because they are already parser-safe.
      if (replacement !== start) {
        modifiedBuffer = buffer.replace(new RegExp(start, "i"), replacement);
      }
      isInToolCall = true;
      break;
    } else if (start.startsWith(lowerCaseBuffer)) {
      isInPartialStart = true;
    }
  }
  return {
    isInToolCall,
    isInPartialStart,
    modifiedBuffer,
  };
}
