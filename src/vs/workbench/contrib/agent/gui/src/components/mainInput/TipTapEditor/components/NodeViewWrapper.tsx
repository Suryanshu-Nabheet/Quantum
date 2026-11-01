import {
  NodeViewWrapper as TiptapNodeViewWrapper,
  NodeViewWrapperProps as TiptapNodeViewWrapperProps,
} from "@tiptap/react";
import React from "react";

interface NodeViewWrapperProps {
  children: React.ReactNode;
}

export const NodeViewWrapper: React.FC<NodeViewWrapperProps> = ({
  children,
}) => {
  // Context previews contain block-level controls and markdown. A paragraph
  // wrapper makes the editor produce invalid nested markup and causes React
  // to repair the DOM during streaming, which can make the preview jump.
  const nodeViewWrapperTag: TiptapNodeViewWrapperProps["as"] = "div";

  return (
    <TiptapNodeViewWrapper className="my-1.5" as={nodeViewWrapperTag}>
      {children}
    </TiptapNodeViewWrapper>
  );
};
