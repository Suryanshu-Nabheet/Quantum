import { ToolImpl } from ".";
import { RuleWithSource } from "../..";
import { addGuiRule, quantumSettingsRuleUri } from "../../config/util";
import {
  getBooleanArg,
  getOptionalStringArg,
  getStringArg,
} from "../parseArgs";

export type CreateRuleBlockArgs = Pick<
  Required<RuleWithSource>,
  "rule" | "name"
> &
  Pick<RuleWithSource, "globs" | "regex" | "description" | "alwaysApply">;

export const createRuleBlockImpl: ToolImpl = async (args, extras) => {
  const name = getStringArg(args, "name");
  const rule = getStringArg(args, "rule");

  const description = getOptionalStringArg(args, "description");
  const regex = getOptionalStringArg(args, "regex");
  const globs = getOptionalStringArg(args, "globs");
  const alwaysApply = getBooleanArg(args, "alwaysApply", false);

  const ruleId = addGuiRule({
    name,
    rule,
    alwaysApply,
    description,
    globs,
    regex,
  });

  return [
    {
      name: "New Rule",
      description: description || "",
      uri: {
        type: "file",
        value: quantumSettingsRuleUri(ruleId),
      },
      content: `Rule created in Quantum Settings`,
    },
  ];
};
