import fs from "fs";
import path from "path";

// Sets up the GLOBAL directory for testing - equivalent to ~/.agent
// IMPORTANT: the AGENT_GLOBAL_DIR environment variable is used in utils/paths for getting all local paths
export default async function () {
  process.env.AGENT_GLOBAL_DIR = path.join(__dirname, ".agent-test");
  const globalDir = process.env.AGENT_GLOBAL_DIR;
  if (globalDir && fs.existsSync(globalDir)) {
    fs.rmSync(globalDir, { recursive: true, force: true });
  }
}
