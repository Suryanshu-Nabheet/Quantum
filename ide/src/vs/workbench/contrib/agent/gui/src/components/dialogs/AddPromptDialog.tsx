import { useContext, useLayoutEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { Input, SecondaryButton } from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";

interface ExistingPrompt {
  promptId: string;
  name: string;
  description?: string;
  prompt: string;
}

function AddPromptDialog({ existingPrompt }: { existingPrompt?: ExistingPrompt }) {
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const [name, setName] = useState(existingPrompt?.name ?? "new-prompt");
  const [description, setDescription] = useState(
    existingPrompt?.description ?? "A short description",
  );
  const [content, setContent] = useState(
    existingPrompt?.prompt ??
      "Write a thorough suite of unit tests for the selected code.",
  );
  const [error, setError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const closeDialog = () => {
    dispatch(setShowDialog(false));
    dispatch(setDialogMessage(undefined));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Prompt name is required");
      return;
    }
    if (!content.trim()) {
      setError("Prompt content is required");
      return;
    }
    setError(undefined);
    setIsSubmitting(true);
    try {
      if (existingPrompt) {
        ideMessenger.post("config/updatePrompt", {
          promptId: existingPrompt.promptId,
          name: trimmed,
          prompt: content.trim(),
          description: description.trim() || undefined,
        });
      } else {
        ideMessenger.post("config/addPrompt", {
          name: trimmed,
          prompt: content.trim(),
          description: description.trim() || undefined,
        });
      }
      closeDialog();
    } catch {
      setIsSubmitting(false);
      setError("Failed to save prompt");
    }
  };

  const title = existingPrompt ? "Edit prompt" : "Add prompt";

  return (
    <div className="px-2 pt-4 sm:px-4">
      <div>
        <h1 className="mb-0">{title}</h1>
        <p className="text-description m-0 mt-2 p-0 text-sm">
          Reusable slash commands stored in Quantum Settings.
        </p>
        <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3">
          <label className="flex w-full flex-col gap-1">
            <span className="text-sm font-medium">Name</span>
            <Input
              ref={inputRef}
              type="text"
              placeholder="ex: write-tests"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="flex w-full flex-col gap-1">
            <span className="text-sm font-medium">Description</span>
            <Input
              type="text"
              placeholder="Short summary shown in the slash menu"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="flex w-full flex-col gap-1">
            <span className="text-sm font-medium">Prompt</span>
            <textarea
              className="bg-input text-foreground min-h-[120px] w-full rounded border border-[color:var(--vscode-sideBar-border,rgba(128,128,128,0.22))] px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-border-focus"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </label>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="mt-2 flex flex-row justify-end gap-2">
            <SecondaryButton
              className="min-w-16"
              disabled={isSubmitting}
              type="submit"
            >
              {existingPrompt ? "Save" : "Create"}
            </SecondaryButton>
            <SecondaryButton
              type="button"
              className="min-w-16"
              onClick={closeDialog}
            >
              Cancel
            </SecondaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddPromptDialog;
