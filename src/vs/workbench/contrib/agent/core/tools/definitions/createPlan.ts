import { GetTool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const createPlanTool: GetTool = async () => ({
  type: "function",
  displayTitle: "Create Plan",
  wouldLikeTo: "create a plan",
  isCurrently: "creating a plan",
  hasAlready: "created a plan",
  group: BUILT_IN_GROUP_NAME,
  readonly: true,
  function: {
    name: BuiltInToolNames.CreatePlan,
    description:
      "Publish the implementation plan once, as the sole tool in that turn. Follow the user's instructions about whether to research; identify assumptions when working without research.",
    parameters: {
      type: "object",
      required: ["title", "overview", "approach", "todos"],
      properties: {
        title: {
          type: "string",
          description: "Short name of the work",
        },
        overview: {
          type: "string",
          description: "One or two sentences: what will change",
        },
        approach: {
          type: "string",
          description:
            "Markdown body of the plan: the problem, the approach, and the files to change. Not a todo list.",
        },
        todos: {
          type: "array",
          description: "Ordered implementation tasks for the build checklist",
          items: { type: "string" },
        },
      },
    },
  },
  systemMessageDescription: {
    prefix: `When the plan is ready, call ${BuiltInToolNames.CreatePlan} once with title, overview, approach (markdown), and todos (an array of strings). Then stop.`,
    exampleArgs: [
      ["title", "Add session export"],
      ["overview", "Export the open chat to markdown without changing history."],
      ["approach", "## Approach\n\nWrite the export next to the session save path already used by saveCurrentSession."],
      ["todos", "[\"Find the session save path\",\"Add an export command\",\"Cover empty history\"]"],
    ],
  },
  defaultToolPolicy: "allowedWithoutPermission",
});
