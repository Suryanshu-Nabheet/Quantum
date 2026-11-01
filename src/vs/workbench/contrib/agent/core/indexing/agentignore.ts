import fs from "fs";
import { IDE } from "..";
import { getGlobalAgentIgnorePath } from "../util/paths";
import { gitIgArrayFromFile } from "./ignore";

export const getGlobalAgentIgArray = () => {
  const contents = fs.readFileSync(getGlobalAgentIgnorePath(), "utf8");
  return gitIgArrayFromFile(contents);
};
