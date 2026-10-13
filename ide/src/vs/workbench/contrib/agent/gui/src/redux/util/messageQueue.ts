import { JSONContent } from "@tiptap/react";
import { InputModifiers } from "core";

/** next-break: after the current tool round. after-turn: when this loop stops. */
export type QueuedMessageWhen = "next-break" | "after-turn";

export interface QueuedMessage {
  id: string;
  editorState: JSONContent;
  modifiers: InputModifiers;
  when: QueuedMessageWhen;
  preview: string;
}

export function editorPreview(editorState: JSONContent): string {
  const parts: string[] = [];
  const walk = (node: JSONContent) => {
    if (typeof node.text === "string" && node.text.trim()) {
      parts.push(node.text.trim());
    } else if (typeof node.attrs?.label === "string" && node.attrs.label.trim()) {
      parts.push(node.attrs.label.trim());
    }
    for (const child of node.content ?? []) {
      walk(child);
    }
  };
  walk(editorState);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * The head of the queue runs at a tool-round break only when it was asked
 * to. When the turn is ending, the head runs either way.
 */
export function queuedMessageToSend(
  queue: QueuedMessage[],
  phase: "break" | "done",
): QueuedMessage | undefined {
  const head = queue[0];
  if (!head) {
    return undefined;
  }
  if (phase === "done" || head.when === "next-break") {
    return head;
  }
  return undefined;
}
