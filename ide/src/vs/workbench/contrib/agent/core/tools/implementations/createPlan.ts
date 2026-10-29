import { TodoItem } from "../..";
import { BuiltInToolNames } from "../builtIn";
import { ToolImpl } from ".";
import { AgentError, AgentErrorReason } from "../../util/errors";

const RESEARCH_TOOL_NAMES = new Set<string>([
  BuiltInToolNames.ReadFile,
  BuiltInToolNames.ReadFileRange,
  BuiltInToolNames.ReadCurrentlyOpenFile,
  BuiltInToolNames.GrepSearch,
  BuiltInToolNames.FileGlobSearch,
  BuiltInToolNames.LSTool,
  BuiltInToolNames.ViewDiff,
  BuiltInToolNames.ViewSubdirectory,
  BuiltInToolNames.ReadSkill,
]);

export function historyHasResearch(
  calls: { name?: string; status: string }[],
): boolean {
  return calls.some(
    (call) =>
      !!call.name &&
      RESEARCH_TOOL_NAMES.has(call.name) &&
      (call.status === "done" || call.status === "errored"),
  );
}

const MAX_TODOS = 30;

export interface AgentPlan {
  title: string;
  overview: string;
  approach: string;
  todos: string[];
}

export function normalizePlan(raw: unknown): AgentPlan {
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const title = typeof record.title === "string" ? record.title.trim() : "";
  const overview =
    typeof record.overview === "string" ? record.overview.trim() : "";
  if (!title) {
    throw new AgentError(AgentErrorReason.Unspecified, "title must be a non-empty string");
  }
  if (!overview) {
    throw new AgentError(
      AgentErrorReason.Unspecified,
      "overview must be a non-empty string",
    );
  }
  const approach = typeof record.approach === "string" ? record.approach.trim() : "";
  if (!approach) {
    throw new AgentError(
      AgentErrorReason.Unspecified,
      "approach must be a non-empty string",
    );
  }
  const todoSource = Array.isArray(record.todos)
    ? record.todos
    : Array.isArray(record.steps)
      ? record.steps
      : undefined;
  if (!todoSource || todoSource.length === 0) {
    throw new AgentError(
      AgentErrorReason.Unspecified,
      "todos must be a non-empty array of strings",
    );
  }
  if (todoSource.length > MAX_TODOS) {
    throw new AgentError(
      AgentErrorReason.Unspecified,
      `todos may contain at most ${MAX_TODOS} items`,
    );
  }
  const todos = todoSource.map((step, index) => {
    const text = typeof step === "string" ? step.trim() : "";
    if (!text) {
      throw new AgentError(
        AgentErrorReason.Unspecified,
        `todos[${index}] must be a non-empty string`,
      );
    }
    return text;
  });
  return { title, overview, approach, todos };
}

export function readPartialPlan(raw: unknown): {
  title: string;
  overview: string;
  approach: string;
  todos: string[];
} {
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const list = Array.isArray(record.todos)
    ? record.todos
    : Array.isArray(record.steps)
      ? record.steps
      : [];
  return {
    title: text(record.title),
    overview: text(record.overview),
    approach: text(record.approach),
    todos: list.flatMap((item) => {
      const value = text(item);
      return value ? [value] : [];
    }),
  };
}

/** Markdown that can render while create_plan arguments are still streaming. */
export function formatStreamingPlan(raw: unknown): string {
  const partial = readPartialPlan(raw);
  return [partial.title ? `# ${partial.title}` : "", partial.overview, partial.approach]
    .filter(Boolean)
    .join("\n\n");
}

export function planFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${slug || "plan"}.plan.md`;
}

export function formatPlanDocument(
  plan: AgentPlan,
  todoProgress?: readonly Pick<TodoItem, "status">[],
): string {
  const todos = plan.todos
    .map((step, index) => `- [${todoProgress?.[index]?.status === "done" ? "x" : " "}] ${step}`)
    .join("\n");
  return `# ${plan.title}\n\n${plan.overview}\n\n${plan.approach}\n\n## Todos\n\n${todos}\n`;
}

export function planToTodos(plan: AgentPlan): TodoItem[] {
  return plan.todos.map((text, index) => ({
    id: `todo-${index + 1}`,
    text,
    status: index === 0 ? "in_progress" : "pending",
  }));
}

export function formatPlanBuildMessage(plan: AgentPlan): string {
  return `Build: ${plan.title}`;
}

export function planBriefBlock(brief: {
  title: string;
  overview: string;
  approach: string;
} | undefined): string {
  if (!brief) {
    return "";
  }
  return `\n\n<plan>\n# ${brief.title}\n\n${brief.overview}\n\n${brief.approach}\n\nImplement this plan. The todos are the build checklist.\n</plan>`;
}

export const createPlanImpl: ToolImpl = async (args) => {
  const plan = normalizePlan(args);
  return [
    {
      name: "Plan",
      description: plan.title,
      content: formatPlanDocument(plan),
      hidden: true,
    },
  ];
};
