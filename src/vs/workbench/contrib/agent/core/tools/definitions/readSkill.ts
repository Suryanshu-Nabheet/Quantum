import { GetTool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const readSkillTool: GetTool = async () => ({
  type: "function",
  displayTitle: "Read Skill",
  wouldLikeTo: "read skill {{{ skillName }}}",
  isCurrently: "reading skill {{{ skillName }}}",
  hasAlready: "read skill {{{ skillName }}}",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.ReadSkill,
    description: "Read the instructions for one skill by its name.",
    parameters: {
      type: "object",
      required: ["skillName"],
      properties: {
        skillName: {
          type: "string",
          description: "The skill name the user asked for.",
        },
      },
    },
  },
});
