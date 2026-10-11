import { describe, expect, it } from "vitest";
import {
  formatPlanBuildMessage,
  formatPlanDocument,
  formatStreamingPlan,
  normalizePlan,
  planFileName,
  planToTodos,
} from "./createPlan";

const sample = {
  title: " Export chats ",
  overview: " Write markdown next to the session. ",
  approach: "## Approach\n\nUse the existing session save path.",
  todos: [" Find the save path ", "Add the command"],
};

describe("normalizePlan", () => {
  it("accepts a title, overview, approach, and todos", () => {
    expect(normalizePlan(sample)).toEqual({
      title: "Export chats",
      overview: "Write markdown next to the session.",
      approach: "## Approach\n\nUse the existing session save path.",
      todos: ["Find the save path", "Add the command"],
    });
  });

  it("still accepts a legacy steps list", () => {
    expect(
      normalizePlan({
        title: "Export chats",
        overview: "Write markdown next to the session.",
        approach: "Use the save path.",
        steps: ["Find the save path"],
      }).todos,
    ).toEqual(["Find the save path"]);
  });

  it("renders one markdown document", () => {
    const plan = normalizePlan(sample);
    expect(planFileName(plan.title)).toBe("export-chats.plan.md");
    expect(formatPlanDocument(plan)).toBe(
      "# Export chats\n\nWrite markdown next to the session.\n\n## Approach\n\nUse the existing session save path.\n\n## Todos\n\n- [ ] Find the save path\n- [ ] Add the command\n",
    );
  });

  it("turns todos into the build checklist with the first in progress", () => {
    const plan = normalizePlan(sample);
    expect(formatPlanBuildMessage(plan)).toBe("Build: Export chats");
    expect(planToTodos(plan)).toEqual([
      { id: "todo-1", text: "Find the save path", status: "in_progress" },
      { id: "todo-2", text: "Add the command", status: "pending" },
    ]);
  });

  it("streams the plan body before the todo list is complete", () => {
    expect(
      formatStreamingPlan({
        title: "Notion-like app",
        overview: "A simple editor.",
        approach: "## Approach\n\nStart with pages.",
      }),
    ).toBe("# Notion-like app\n\nA simple editor.\n\n## Approach\n\nStart with pages.");
  });

  it("rejects an empty todo list", () => {
    expect(() =>
      normalizePlan({ title: "A", overview: "B", approach: "C", todos: [] }),
    ).toThrow(/todos must be a non-empty array/);
  });
});
