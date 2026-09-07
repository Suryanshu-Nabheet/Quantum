import { ChatBubbleLeftIcon } from "@heroicons/react/24/outline";
import { NodeViewProps } from "@tiptap/react";
import { useContext, useEffect } from "react";
import { IdeMessengerContext } from "../../../../../context/IdeMessenger";
import { useAppDispatch } from "../../../../../redux/hooks";
import { setNewestToolbarPreviewForInput } from "../../../../../redux/slices/sessionSlice";
import { ExpandableToolbarPreview } from "../../components/ExpandableToolbarPreview";
import { NodeViewWrapper } from "../../components/NodeViewWrapper";
import { PromptBlockAttributes } from "./PromptBlock";

/**
 * Component for prompt blocks in the Tiptap editor
 */
export const PromptBlockPreview = ({ node, editor }: NodeViewProps) => {
  const { item, inputId } = node.attrs as PromptBlockAttributes;

  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useAppDispatch();

  // Register a freshly inserted prompt as the newest attachment so it behaves
  // exactly like browser element / console-log context: expanded on add, then
  // collapsing to a compact chip once another item is attached.
  useEffect(() => {
    if (inputId && item?.id?.itemId) {
      dispatch(
        setNewestToolbarPreviewForInput({
          inputId,
          contextItemId: item.id.itemId,
        }),
      );
    }
    // Only run when the prompt identity changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputId, item?.id?.itemId]);

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    ideMessenger.post("showVirtualFile", {
      content: item.content,
      name: item.name,
    });
  };

  const handleDelete = () => {
    editor.commands.clearPrompt();
  };

  return (
    <NodeViewWrapper>
      <ExpandableToolbarPreview
        title={item.name}
        icon={<ChatBubbleLeftIcon className="h-3 w-3 pl-1 pr-0.5" />}
        inputId={inputId}
        itemId={item.id.itemId}
        onDelete={handleDelete}
        onTitleClick={!item.content ? undefined : handleTitleClick}
      >
        {!item.content ? null : (
          <div
            className="whitespace-pre-wrap px-3 py-1 text-xs"
            contentEditable={false}
          >
            {item.content}
          </div>
        )}
      </ExpandableToolbarPreview>
    </NodeViewWrapper>
  );
};
