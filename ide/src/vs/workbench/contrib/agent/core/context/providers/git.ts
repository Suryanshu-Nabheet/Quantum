import { IDE } from "../../index.js";
import { localPathOrUriToPath } from "../../util/pathToUri.js";

export function gitWorkingDirectory(workspaceDirs: string[]): string | undefined {
  const fileDir = workspaceDirs.find((dir) => dir.startsWith("file:/"));
  if (fileDir) {
    return localPathOrUriToPath(fileDir);
  }

  const remoteDir = workspaceDirs.find(
    (dir) => dir.includes("://") && !dir.startsWith("file:/"),
  );
  if (remoteDir) {
    try {
      return decodeURIComponent(new URL(remoteDir).pathname);
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export async function runGitCommand(
  ide: IDE,
  args: string[],
  cwd: string,
): Promise<string> {
  const command = ["git", ...args].join(" ");
  const [stdout] = await ide.subprocess(command, cwd);
  return stdout;
}
