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
      "Maintain the task list for a multi-step job. Call this with the COMPLETE list every time: it replaces the previous list. Mark exactly one item in_progress at a time, and mark items done as soon as they are finished. Use it to plan long tasks and to stay on track across many steps.",
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
    prefix: `To track multi-step work, call ${BuiltInToolNames.WriteTodos} with the complete ordered task list as an array of { text, status } objects, where status is pending, in_progress, or done. Keep exactly one item in_progress and mark items done when finished.`,
    exampleArgs: [["todos", "[{\"text\":\"Read the config\",\"status\":\"in_progress\"}]"]],
  },
  defaultToolPolicy: "allowedWithoutPermission",
});
