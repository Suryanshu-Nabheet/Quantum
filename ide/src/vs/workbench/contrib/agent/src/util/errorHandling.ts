import { ILLM } from "core";
import { isModelInstaller } from "core/llm";
import * as vscode from "vscode";

import { QUANTUM_SETTINGS } from "./extensionMeta";

/**
 * @param error Handles common LLM errors. Currently handles Ollama and Lemonade-related errors.
 * @returns true if error is handled, false otherwise
 */
export async function handleLLMError(error: unknown): Promise<boolean> {
  if (!error || !(error instanceof Error) || !error.message) {
    return false;
  }

  if (
    error.message.includes("subscription") ||
    error.message.includes("ollama.com/upgrade")
  ) {
    vscode.window
      .showErrorMessage(
        `This Ollama cloud model needs an active Ollama account/plan. Run \`ollama signin\` in a terminal, or set OLLAMA_API_KEY on the API key field for Ollama in ${QUANTUM_SETTINGS} → Models.`,
        "Ollama cloud docs",
        "Open Settings",
      )
      .then((val) => {
        if (val === "Ollama cloud docs") {
          void vscode.env.openExternal(
            vscode.Uri.parse("https://docs.ollama.com/cloud"),
          );
        } else if (val === "Open Settings") {
          void vscode.commands.executeCommand("agent.openConfigPage");
        }
      });
    return true;
  }

  // Handle Lemonade errors
  if (error.message.toLowerCase().includes("lemonade")) {
    let message: string = error.message;
    let options: string[] | undefined;

    // For Windows, offer to start Lemonade if it's installed but not running
    if (
      process.platform === "win32" &&
      message.includes("Lemonade server may not be running")
    ) {
      options = ["Start Lemonade", "Setup Instructions"];
    } else {
      // For all other cases (Linux, not installed, etc.), direct to setup instructions
      options = ["Setup Instructions"];
    }

    vscode.window.showErrorMessage(message, ...options).then((val) => {
      if (val === "Setup Instructions") {
        vscode.env.openExternal(vscode.Uri.parse("https://lemonade-server.ai"));
      } else if (val === "Start Lemonade") {
        vscode.commands.executeCommand("agent.startLocalLemonade");
      }
    });
    return true;
  }

  // Handle Ollama autocomplete / FIM capability errors
  if (
    error.message.includes("does not support insert") ||
    error.message.includes("not support insert")
  ) {
    vscode.window
      .showWarningMessage(
        `The autocomplete model does not support Ollama insert/FIM mode. Agent will use prompt-based autocomplete instead. For best results, assign a code model (e.g. qwen2.5-coder, codestral, deepseek-coder) to the Autocomplete role in ${QUANTUM_SETTINGS} → Models.`,
        "Open Settings",
      )
      .then((val) => {
        if (val === "Open Settings") {
          void vscode.commands.executeCommand("agent.openConfigPage");
        }
      });
    return true;
  }

  // Handle Ollama errors
  if (!error.message.toLowerCase().includes("ollama")) {
    return false;
  }
  let message: string = error.message;
  let options: string[] | undefined;
  let modelName = undefined;
  if (message.includes("Ollama may not be installed")) {
    options = ["Download Ollama"];
  } else if (message.includes("Ollama may not be running")) {
    options = ["Start Ollama"]; // We want "Start" to be the only choice
  } else if (message.includes("ollama run") && "llm" in error) {
    //extract model name from error message matching the pattern "ollama run <model-name>"
    modelName = message.match(/`ollama run (.*)`/)?.[1];
    const llm = error.llm as ILLM;
    if (isModelInstaller(llm) && (await llm.isInstallingModel(modelName!))) {
      console.log(`${llm.providerName} already installing ${modelName}`);
      return false;
    }
    message = `Model "${modelName}" is not found in Ollama. You need to install it.`;
    options = [`Install Model`];
  }
  if (options === undefined) {
    console.log("Found an unhandled Ollama error: ", message);
    return false;
  }

  vscode.window.showErrorMessage(message, ...options).then((val) => {
    if (val === "Download Ollama") {
      vscode.env.openExternal(vscode.Uri.parse("https://ollama.ai/download"));
    } else if (val === "Start Ollama") {
      vscode.commands.executeCommand("agent.startLocalOllama");
    } else if (val === "Install Model" && "llm" in error) {
      //Eventually, we might be able to support installing models for other LLM providers than Ollama
      vscode.commands.executeCommand(
        "agent.installModel",
        modelName,
        error.llm,
      );
    }
  });
  return true;
}
