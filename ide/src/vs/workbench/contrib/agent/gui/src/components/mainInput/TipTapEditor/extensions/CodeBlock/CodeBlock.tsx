import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CodeBlockPreview } from "./CodeBlockPreview";

export const CodeBlock = Node.create({
  name: "code-block",

  group: "block",

  content: "inline*",

  atom: true,

  selectable: true,

  parseHTML() {
    return [
      {
        tag: "code-block",
      },
    ];
  },

  addAttributes() {
    return {
      item: {
        default: "",
      },
      inputId: {
        default: "",
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    return ["code-block", mergeAttributes(HTMLAttributes), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockPreview, {
      // The chip is a self-contained interactive widget (expand/collapse, open,
      // delete). Let the DOM handle pointer input instead of ProseMirror so a
      // click on its controls never creates a transient NodeSelection, which
      // otherwise flashes the chip's selected border for a frame. React's
      // onClick still fires; only ProseMirror's own selection handling is
      // skipped for these events.
      stopEvent: ({ event }) =>
        event.type.startsWith("mouse") ||
        event.type.startsWith("pointer") ||
        event.type.startsWith("touch"),
    });
  },
});
