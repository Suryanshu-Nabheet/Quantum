import { useContext, useLayoutEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { Input, SecondaryButton } from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function AddSkillDialog({ onCreated }: { onCreated?: () => void }) {
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const [name, setName] = useState("new-skill");
  const [description, setDescription] = useState(
    "Describe when the agent should use this skill.",
  );
  const [error, setError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const closeDialog = () => {
    dispatch(setShowDialog(false));
    dispatch(setDialogMessage(undefined));
  };

  const slug = slugify(name);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) {
      setError("A skill name is required");
      return;
    }
    if (!description.trim()) {
      setError("A description is required so the agent knows when to use it");
      return;
    }

    setError(undefined);
    setIsSubmitting(true);
    try {
      const workspaceDirs = await ideMessenger.ide.getWorkspaceDirs();
      const baseDir = workspaceDirs[0];
      if (!baseDir) {
        setError("Open a workspace folder to create a skill");
        setIsSubmitting(false);
        return;
      }

      const dir = baseDir.replace(/\/+$/, "");
      const fileUri = `${dir}/.agents/skills/${slug}/SKILL.md`;

      if (await ideMessenger.ide.fileExists(fileUri)) {
        setError(`A skill named "${slug}" already exists`);
        setIsSubmitting(false);
        return;
      }

      const title = slug
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

      const content = `---
name: ${slug}
description: ${description.trim()}
---

# ${title}

Describe step-by-step how the agent should perform this task. This file is
loaded on demand when its description matches what you're working on.
`;

      await ideMessenger.ide.writeFile(fileUri, content);
      await ideMessenger.ide.openFile(fileUri);
      onCreated?.();
      closeDialog();
    } catch {
      setIsSubmitting(false);
      setError("Failed to create skill");
    }
  };

  return (
    <div className="px-2 pt-4 sm:px-4">
      <div>
        <h1 className="mb-0">Add skill</h1>
        <p className="text-description m-0 mt-2 p-0 text-sm">
          Skills are Markdown files the agent loads on demand. This creates{" "}
          <code className="text-2xs">.agents/skills/{slug || "name"}/SKILL.md</code>{" "}
          and opens it for editing.
        </p>
        <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3">
          <label className="flex w-full flex-col gap-1">
            <span className="text-sm font-medium">Name</span>
            <Input
              ref={inputRef}
              type="text"
              placeholder="ex: review-pr"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="flex w-full flex-col gap-1">
            <span className="text-sm font-medium">Description</span>
            <textarea
              className="bg-input text-foreground min-h-[72px] w-full rounded border border-[color:var(--vscode-sideBar-border,rgba(128,128,128,0.22))] px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-border-focus"
              placeholder="Tell the agent when to reach for this skill"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="mt-2 flex flex-row justify-end gap-2">
            <SecondaryButton
              className="min-w-16"
              disabled={isSubmitting}
              type="submit"
            >
              Create
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

export default AddSkillDialog;
