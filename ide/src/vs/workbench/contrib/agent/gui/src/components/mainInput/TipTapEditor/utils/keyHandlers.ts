import { Editor } from "@tiptap/react";
import { KeyboardEvent, useRef } from "react";
import { isMetaEquivalentKeyPressed } from "../../../../util";
import {
  handleVSCMetaKeyIssues,
} from "../../util/handleMetaKeyIssues";

export function useEditorEventHandlers(options: {
  editor: Editor | null;
  editorFocusedRef: React.MutableRefObject<boolean | undefined>;
  setActiveKey: (key: string | null) => void;
}) {
  const { editor, editorFocusedRef, setActiveKey } = options;
  const metaActiveRef = useRef(false);

  const handleKeyDown = async (e: KeyboardEvent<HTMLDivElement>) => {
    if (!editor) {
      return;
    }

    if (!editorFocusedRef?.current || !isMetaEquivalentKeyPressed(e)) return;

    // Only set activeKey for Meta/Control/Alt to drive toolbar highlighting
    if (e.key === "Meta" || e.key === "Control" || e.key === "Alt") {
      setActiveKey(e.key);
      metaActiveRef.current = true;
    }

    await handleVSCMetaKeyIssues(e, editor);
  };

  const handleKeyUp = () => {
    if (metaActiveRef.current) {
      setActiveKey(null);
      metaActiveRef.current = false;
    }
  };

  return { handleKeyDown, handleKeyUp };
}
