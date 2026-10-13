import { expect, test } from "vitest";
import { editorPreview, queuedMessageToSend, QueuedMessage } from "./messageQueue";

function item(id: string, when: QueuedMessage["when"]): QueuedMessage {
  return {
    id,
    when,
    preview: id,
    editorState: { type: "doc" },
    modifiers: { noContext: true },
  };
}

test("editor preview joins text and mention labels", () => {
  expect(
    editorPreview({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "add" },
            { type: "mention", attrs: { label: "output.rs" } },
            { type: "text", text: "yaml" },
          ],
        },
      ],
    }),
  ).toBe("add output.rs yaml");
});

test("a next-break message sends at a tool break", () => {
  expect(queuedMessageToSend([item("a", "next-break")], "break")?.id).toBe("a");
});

test("an after-turn message waits until the loop ends", () => {
  const queue = [item("a", "after-turn"), item("b", "next-break")];
  expect(queuedMessageToSend(queue, "break")).toBeUndefined();
  expect(queuedMessageToSend(queue, "done")?.id).toBe("a");
});
