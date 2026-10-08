import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import dotenv from "dotenv";
dotenv.config();

const AGENT_GLOBAL_DIR = (() => {
  const configPath = process.env.AGENT_GLOBAL_DIR;
  if (configPath) {
    // Convert relative path to absolute paths based on current working directory
    return path.isAbsolute(configPath)
      ? configPath
      : path.resolve(process.cwd(), configPath);
  }
  return path.join(os.homedir(), ".agent");
})();

export function getGlobalAgentIgnorePath(): string {
  const agentIgnorePath = path.join(
    getAgentGlobalPath(),
    ".agentignore",
  );
  if (!fs.existsSync(agentIgnorePath)) {
    fs.writeFileSync(agentIgnorePath, "");
  }
  return agentIgnorePath;
}

/** Local cache for transformers.js embedding models (downloaded on first use). */
export function getEmbeddingModelsPath(): string {
  const modelsPath = path.join(getAgentGlobalPath(), "models");
  if (!fs.existsSync(modelsPath)) {
    fs.mkdirSync(modelsPath, { recursive: true });
  }
  return modelsPath;
}

export function getAgentGlobalPath(): string {
  // This is ~/.agent on mac/linux
  const agentPath = AGENT_GLOBAL_DIR;
  if (!fs.existsSync(agentPath)) {
    fs.mkdirSync(agentPath);
  }
  return agentPath;
}

export function getSessionsFolderPath(): string {
  const sessionsPath = path.join(getAgentGlobalPath(), "sessions");
  if (!fs.existsSync(sessionsPath)) {
    fs.mkdirSync(sessionsPath);
  }
  return sessionsPath;
}

export function getIndexFolderPath(): string {
  const indexPath = path.join(getAgentGlobalPath(), "index");
  if (!fs.existsSync(indexPath)) {
    fs.mkdirSync(indexPath);
  }
  return indexPath;
}

export function getGlobalContextFilePath(): string {
  return path.join(getIndexFolderPath(), "globalContext.json");
}

export function getSharedConfigFilePath(): string {
  return path.join(getAgentGlobalPath(), "sharedConfig.json");
}

export function getSessionFilePath(sessionId: string): string {
  return path.join(getSessionsFolderPath(), `${sessionId}.json`);
}

export function getSessionsListPath(): string {
  const filepath = path.join(getSessionsFolderPath(), "sessions.json");
  if (!fs.existsSync(filepath)) {
    fs.writeFileSync(filepath, JSON.stringify([]));
  }
  return filepath;
}

export function getAgentRcPath(): string {
  const agentrcPath = path.join(getAgentGlobalPath(), ".agentrc.json");
  if (!fs.existsSync(agentrcPath)) {
    fs.writeFileSync(agentrcPath, JSON.stringify({}, null, 2));
  }
  return agentrcPath;
}

export function getGlobalFolderWithName(name: string): string {
  return path.join(getAgentGlobalPath(), name);
}

;
