import { ToolImpl } from ".";
import { TodoItem, TodoStatus } from "../..";
import { AgentError, AgentErrorReason } from "../../util/errors";

const STATUSES: TodoStatus[] = ["pending", "in_progress", "done"];
const MAX_TODOS = 100;

/**
 * Validates a complete todo list submitted by the agent. Returns normalized
 * items with stable ids. Throws AgentError on invalid input so the model is
 * told exactly what to fix.
 */
export function normalizeTodos(raw: unknown): TodoItem[] {
  if (!Array.isArray(raw)) {
    throw new AgentError(
      AgentErrorReason.Unspecified,
      "todos must be an array of { text, status } objects",
    );
  }
  if (raw.length > MAX_TODOS) {
    throw new AgentError(
      AgentErrorReason.Unspecified,
      `todos may contain at most ${MAX_TODOS} items`,
    );
  }

  const items: TodoItem[] = raw.map((entry, index) => {
    const text = typeof entry?.text === "string" ? entry.text.trim() : "";
    const status = entry?.status;
    if (!text) {
      throw new AgentError(
        AgentErrorReason.Unspecified,
        `todos[${index}].text must be a non-empty string`,
      );
    }
    if (!STATUSES.includes(status)) {
      throw new AgentError(
        AgentErrorReason.Unspecified,
        `todos[${index}].status must be one of pending, in_progress, done`,
      );
    }
    return { id: `todo-${index + 1}`, text, status };
  });

  const inProgress = items.filter((item) => item.status === "in_progress");
  if (inProgress.length > 1) {
    throw new AgentError(
      AgentErrorReason.Unspecified,
      "only one todo may be in_progress at a time",
    );
  }

  return items;
}

/** Compact, model-readable summary of the list so the agent sees its plan. */
export function summarizeTodos(items: TodoItem[]): string {
  const done = items.filter((i) => i.status === "done").length;
  const lines = items.map((i) => {
    const mark =
      i.status === "done" ? "[x]" : i.status === "in_progress" ? "[~]" : "[ ]";
    return `${mark} ${i.text}`;
  });
  return `Todos ${done}/${items.length} done:\n${lines.join("\n")}`;
}

export const writeTodosImpl: ToolImpl = async (args) => {
  const items = normalizeTodos(args?.todos);
  return [
    {
      name: "Todos",
      description: "Todo list updated",
      content: summarizeTodos(items),
      hidden: false,
    },
  ];
};
