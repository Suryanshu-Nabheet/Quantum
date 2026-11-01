import { Editor } from "@tiptap/react";
import { InputModifiers, ContextItemWithId } from "core";
import { v4 as uuidv4 } from "uuid";
import { rifWithContentsToContextItem } from "core/commands/util";
import { MutableRefObject } from "react";
import { useWebviewListener } from "../../../hooks/useWebviewListener";
import { clearCodeToEdit } from "../../../redux/slices/editState";
import { setNewestToolbarPreviewForInput } from "../../../redux/slices/sessionSlice";
import { AppDispatch } from "../../../redux/store";
import { loadSession, saveCurrentSession } from "../../../redux/thunks/session";
import { CodeBlock, PromptBlock } from "./extensions";

/**
 * Hook for setting up main editor specific webview listeners
 */
export function useMainEditorWebviewListeners({
  editor,
  onEnterRef,
  dispatch,
  historyLength,
  inputId,
  editorFocusedRef,
}: {
  editor: Editor | null;
  onEnterRef: MutableRefObject<(modifiers: InputModifiers) => void>;
  dispatch: AppDispatch;
  historyLength: number;
  inputId: string;
  editorFocusedRef: MutableRefObject<boolean | undefined>;
}) {
  useWebviewListener(
    "isAgentInputFocused",
    async () => {
      return !!editorFocusedRef.current;
    },
    [editorFocusedRef],
  );

  useWebviewListener(
    "isMainEditorReady",
    async () => {
      return {
        ready: !!editor && !editor.isDestroyed && !!inputId,
      };
    },
    [editor, inputId],
  );

  useWebviewListener(
    "userInput",
    async (data) => {
      if (!editor) return;
      editor.commands.insertContent(data.input);
      onEnterRef.current({ noContext: true });
    },
    [editor, onEnterRef.current],
  );


  useWebviewListener(
    "focusAgentInput",
    async () => {
      dispatch(clearCodeToEdit());

      if (historyLength > 0) {
        await dispatch(
          saveCurrentSession({
            openNewSession: false,
            generateTitle: true,
          }),
        );
      }

      setTimeout(() => {
        editor?.commands.blur();
        editor?.commands.focus("end");
      }, 20);
    },
    [historyLength, editor, dispatch],
  );

  useWebviewListener(
    "focusAgentInputWithoutClear",
    async () => {
      setTimeout(() => {
        editor?.commands.focus("end");
      }, 20);
    },
    [editor],
  );

  useWebviewListener(
    "focusAgentInputWithNewSession",
    async () => {
      await dispatch(
        saveCurrentSession({
          openNewSession: true,
          generateTitle: true,
        }),
      );

      setTimeout(() => {
        editor?.commands.focus("end");
      }, 20);
    },
    [editor, dispatch],
  );

  useWebviewListener(
    "highlightedCode",
    async (data) => {
      if (!editor) return;

      const contextItem = rifWithContentsToContextItem(
        data.rangeInFileWithContents,
      );

      let index = 0;
      for (const el of editor.getJSON()?.content ?? []) {
        // Prevent exact duplicate code blocks
        if (el.attrs?.item?.name === contextItem.name) {
          return;
        }

        if (el.type === CodeBlock.name || el.type === PromptBlock.name) {
          index += 2;
        } else {
          break;
        }
      }

      editor
        .chain()
        .insertContentAt(index, {
          type: CodeBlock.name,
          attrs: {
            item: contextItem,
            inputId,
          },
        })
        .run();

      dispatch(
        setNewestToolbarPreviewForInput({
          inputId,
          contextItemId: contextItem.id.itemId,
        }),
      );

      if (data.prompt) {
        editor.commands.focus("end");
        editor.commands.insertContent(data.prompt);
      }

      if (data.shouldRun) {
        onEnterRef.current({ noContext: true });
      }

      setTimeout(() => {
        editor.commands.blur();
        editor.commands.focus("end");
      }, 20);
    },
    [editor, inputId, onEnterRef.current],
  );

  useWebviewListener(
    "focusAgentSessionId",
    async (data) => {
      if (!data.sessionId) return;

      await dispatch(
        loadSession({
          sessionId: data.sessionId,
          saveCurrentSession: true,
        }),
      );
    },
    [],
  );

  useWebviewListener(
    "addToChat",
    async (data) => {
      if (!editor) return;
      let chain = editor.chain();

      for (let mention of data.data) {
        chain
          .insertContent({
            type: "mention",
            attrs: {
              id: mention.fullPath,
              query: mention.fullPath,
              itemType: mention.type,
              label: mention.name,
            },
          })
          .insertContent(" ");
      }

      chain.run();
    },
    [editor],
  );

  useWebviewListener(
    "attachBrowserContext",
    async (data) => {
      if (!editor || editor.isDestroyed) {
        return { attached: false };
      }

      const contextItem: ContextItemWithId = {
        name: data.name,
        description: data.description,
        content: data.content,
        id: {
          providerTitle: data.providerTitle ?? "browser",
          itemId: uuidv4(),
        },
        uri: data.uri
          ? {
              type: "url",
              value: data.uri,
            }
          : undefined,
      };

      const doc = editor.getJSON()?.content ?? [];
      let index = 0;
      let alreadyAttached = false;

      for (const el of doc) {
        if (
          el.type === CodeBlock.name &&
          el.attrs?.item?.uri?.value === contextItem.uri?.value &&
          el.attrs?.item?.description === contextItem.description &&
          el.attrs?.item?.content === contextItem.content
        ) {
          alreadyAttached = true;
          break;
        }
        if (el.type === CodeBlock.name || el.type === PromptBlock.name) {
          index += 2;
        } else {
          break;
        }
      }

      if (alreadyAttached) {
        return { attached: true };
      }

      const attached = editor
        .chain()
        .insertContentAt(index, {
          type: CodeBlock.name,
          attrs: {
            item: contextItem,
            inputId,
          },
        })
        .run();

      if (!attached) {
        return { attached: false };
      }

      dispatch(
        setNewestToolbarPreviewForInput({
          inputId,
          contextItemId: contextItem.id.itemId,
        }),
      );

      setTimeout(() => {
        if (!editor.isDestroyed) {
          editor.commands.focus("end");
        }
      }, 100);

      return { attached: true };
    },
    [editor, dispatch, inputId],
  );
}
