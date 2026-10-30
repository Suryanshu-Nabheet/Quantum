import { GetTool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const writeTodosTool: GetTool = async () => ({
  type: "function",
  displayTitle: "Update Todos",
  wouldLikeTo: "update the todo list",
  isCurrently: "updating the todo list",
  hasAlready: "updated the todo list",
  group: BUILT_IN_GROUP_NAME,
  readonly: false,
  function: {
    name: BuiltInToolNames.WriteTodos,
    description:
      "Maintain the task list for a multi-step job. Call this with the COMPLETE list every time: it replaces the previous list. Keep at most one item in_progress; mark each item done as soon as its work and verification are complete, and mark all items done when the list is finished. Use it to plan long tasks and stay on track across many steps.",
    parameters: {
      type: "object",
      required: ["todos"],
      properties: {
        todos: {
          type: "array",
          description: "The full, ordered task list",
          items: {
            type: "object",
            required: ["text", "status"],
            properties: {
              text: {
                type: "string",
                description: "What this task accomplishes",
              },
              status: {
                type: "string",
                enum: ["pending", "in_progress", "done"],
              },
            },
          },
        },
      },
    },
  },
  systemMessageDescription: {
    prefix: `To track multi-step work, call ${BuiltInToolNames.WriteTodos} with the complete ordered task list as an array of { text, status } objects, where status is pending, in_progress, or done. Keep at most one item in_progress. Mark an item done when its work and verification are complete, then move the next unfinished item to in_progress. When all work is complete, mark every item done.`,
    exampleArgs: [["todos", "[{\"text\":\"Read the config\",\"status\":\"in_progress\"}]"]],
  },
  defaultToolPolicy: "allowedWithoutPermission",
});
