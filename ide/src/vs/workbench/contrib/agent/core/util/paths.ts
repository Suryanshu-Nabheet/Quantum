import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as URI from "uri-js";
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

export function getAgentUtilsPath(): string {
  const utilsPath = path.join(getAgentGlobalPath(), ".utils");
  if (!fs.existsSync(utilsPath)) {
    fs.mkdirSync(utilsPath);
  }
  return utilsPath;
}

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

function getMigrationsFolderPath(): string {
  const migrationsPath = path.join(getAgentGlobalPath(), ".migrations");
  if (!fs.existsSync(migrationsPath)) {
    fs.mkdirSync(migrationsPath);
  }
  return migrationsPath;
}

export async function migrate(
  id: string,
  callback: () => void | Promise<void>,
  onAlreadyComplete?: () => void,
) {
  if (process.env.NODE_ENV === "test") {
    return await Promise.resolve(callback());
  }

  const migrationsPath = getMigrationsFolderPath();
  const migrationPath = path.join(migrationsPath, id);

  if (!fs.existsSync(migrationPath)) {
    try {
      console.log(`Running migration: ${id}`);

      fs.writeFileSync(migrationPath, "");
      await Promise.resolve(callback());
    } catch (e) {
      console.warn(`Migration ${id} failed`, e);
    }
  } else if (onAlreadyComplete) {
    onAlreadyComplete();
  }
}

export function getAgentDotEnv(): { [key: string]: string } {
  const filepath = path.join(getAgentGlobalPath(), ".env");
  if (fs.existsSync(filepath)) {
    return dotenv.parse(fs.readFileSync(filepath));
  }
  return {};
}

export function getLogsDirPath(): string {
  const logsPath = path.join(getAgentGlobalPath(), "logs");
  if (!fs.existsSync(logsPath)) {
    fs.mkdirSync(logsPath);
  }
  return logsPath;
}

export function getCoreLogsPath(): string {
  return path.join(getLogsDirPath(), "core.log");
}

export function getPromptLogsPath(): string {
  return path.join(getLogsDirPath(), "prompt.log");
}

export function getGlobalFolderWithName(name: string): string {
  return path.join(getAgentGlobalPath(), name);
}

export function getEsbuildBinaryPath(): string {
  return path.join(getAgentUtilsPath(), "esbuild");
}


export function getDiffsDirectoryPath(): string {
  const diffsPath = path.join(getAgentGlobalPath(), ".diffs"); // .replace(/^C:/, "c:"); ??
  if (!fs.existsSync(diffsPath)) {
    fs.mkdirSync(diffsPath, {
      recursive: true,
    });
  }
  return diffsPath;
}

export const isFileWithinFolder = (
  fileUri: string,
  folderPath: string,
): boolean => {
  try {
    if (!fileUri || !folderPath) {
      return false;
    }

    const fileUriParsed = URI.parse(fileUri);
    const fileScheme = fileUriParsed.scheme || "file";
    let filePath = fileUriParsed.path || "";
    filePath = decodeURIComponent(filePath);

    let folderWithScheme = folderPath;
    if (!folderPath.includes("://")) {
      folderWithScheme = `${fileScheme}://${folderPath.startsWith("/") ? "" : "/"}${folderPath}`;
    }
    const folderUriParsed = URI.parse(folderWithScheme);

    let folderPathClean = folderUriParsed.path || "";
    folderPathClean = decodeURIComponent(folderPathClean);

    filePath = filePath.replace(/\/$/, "");
    folderPathClean = folderPathClean.replace(/\/$/, "");

    return (
      filePath === folderPathClean || filePath.startsWith(`${folderPathClean}/`)
    );
  } catch (error) {
    console.error("Error in isFileWithinFolder:", error);
    return false;
  }
};
