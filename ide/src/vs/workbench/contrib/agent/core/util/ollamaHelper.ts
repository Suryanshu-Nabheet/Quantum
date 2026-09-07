import crypto from "crypto";
import { exec } from "node:child_process";
import path from "node:path";
import { IDE } from "..";

export type OllamaModelTag = {
  name: string;
  remote_host?: string;
};

/** Cloud models registered on a local daemon expose `remote_host` in /api/tags. */
export function isOllamaCloudModelTag(
  tag: Pick<OllamaModelTag, "remote_host">,
): boolean {
  return Boolean(tag.remote_host?.trim());
}

/** Fallback when only a configured model name is available (no tag metadata). */
export function isOllamaCloudModelName(modelName: string): boolean {
  const lower = modelName.toLowerCase();
  const modelTag = lower.includes(":")
    ? (lower.split(":").pop() ?? lower)
    : lower;
  return modelTag === "cloud" || modelTag.endsWith("-cloud");
}

/** Ollama FIM uses /api/generate with suffix (insert mode). Many chat models reject it. */
export function isOllamaInsertUnsupportedError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes("does not support insert") ||
    message.includes("not support insert")
  );
}

/**
 * Models that are very unlikely to support Ollama insert/FIM even before /api/show returns.
 * Used to avoid noisy 400s from general chat models (e.g. qwen3.5:4b).
 */
export function isOllamaModelKnownNonFim(modelName: string): boolean {
  if (isOllamaCloudModelName(modelName)) {
    return false;
  }
  const lower = modelName.toLowerCase();
  const fimCapableHints = [
    "coder",
    "codestral",
    "codegemma",
    "deepseek-coder",
    "starcoder",
    "star-coder",
    "codeqwen",
    "codellama",
    "code-llama",
    "granite-code",
    "fim",
  ];
  if (fimCapableHints.some((hint) => lower.includes(hint))) {
    return false;
  }
  if (lower.includes("qwen")) {
    return true;
  }
  return false;
}

/** Local models first so autodetect defaults stay local; cloud models remain selectable. */
export function sortOllamaModelTagsLocalFirst(
  tags: OllamaModelTag[],
): OllamaModelTag[] {
  return [...tags].sort((a, b) => {
    const aCloud = isOllamaCloudModelTag(a) ? 1 : 0;
    const bCloud = isOllamaCloudModelTag(b) ? 1 : 0;
    return aCloud - bCloud;
  });
}

export interface ModelInfo {
  id: string;
  size: number;
  digest: string;
}

export async function isOllamaInstalled(): Promise<boolean> {
  return new Promise((resolve, _reject) => {
    const command =
      process.platform === "win32" ? "where.exe ollama" : "which ollama";
    exec(command, (error, _stdout, _stderr) => {
      resolve(!error);
    });
  });
}

export async function startLocalOllama(ide: IDE): Promise<any> {
  let startCommand: string | undefined;

  switch (process.platform) {
    case "darwin": //MacOS
      startCommand = "open -a Ollama.app\n";
      break;

    case "win32": //Windows
      startCommand = '& "ollama app.exe"\n';
      break;

    default: //Linux...
      const start_script_path = path.resolve(__dirname, "./start_ollama.sh");
      if (await ide.fileExists(`file:/${start_script_path}`)) {
        startCommand = `set -e && chmod +x ${start_script_path} && ${start_script_path}\n`;
        console.log(`Ollama Linux startup script at : ${start_script_path}`);
      } else {
        return ide.showToast(
          "error",
          `Cannot start Ollama: could not find ${start_script_path}!`,
        );
      }
  }
  if (startCommand) {
    return ide.runCommand(startCommand, {
      reuseTerminal: true,
      terminalName: "Start Ollama",
    });
  }
}
