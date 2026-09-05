import fs from "fs";
import { IDE } from "..";
import { getGlobalAgentIgnorePath } from "../util/paths";
import { gitIgArrayFromFile } from "./ignore";

export const getGlobalAgentIgArray = () => {
  const contents = fs.readFileSync(getGlobalAgentIgnorePath(), "utf8");
  return gitIgArrayFromFile(contents);
};

export const getWorkspaceAgentIgArray = async (ide: IDE) => {
  const dirs = await ide.getWorkspaceDirs();
  return await dirs.reduce(
    async (accPromise, dir) => {
      const acc = await accPromise;
      try {
        const contents = await ide.readFile(`${dir}/.agentignore`);
        return [...acc, ...gitIgArrayFromFile(contents)];
      } catch (err) {
        console.error(err);
        return acc;
      }
    },
    Promise.resolve([] as string[]),
  );
};
