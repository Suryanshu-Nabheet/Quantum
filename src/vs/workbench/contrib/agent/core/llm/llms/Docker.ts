import { Mutex } from "async-mutex";
import { spawn } from "child_process";
import { LLMOptions, ModelInstaller } from "../../index.js";
import OpenAI from "./OpenAI.js";

/**
 * Docker Model Runner provider
 *
 * Integrates with Docker Desktop's Model Runner feature (currently in beta)
 * that allows running local AI models through Docker.
 *
 * Docker Model Runner provides an OpenAI-compatible API endpoint, making it
 * easy to integrate with existing OpenAI-compatible code.
 *
 * More information at: https://docs.docker.com/desktop/features/model-runner/
 */
class Docker extends OpenAI implements ModelInstaller {
  static providerName = "docker";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "http://localhost:12434/engines/v1/",
  };

  private static modelsBeingInstalled: Set<string> = new Set();
  private static modelsBeingInstalledMutex = new Mutex();

  constructor(options: LLMOptions) {
    super(options);

    // Check if Docker Model Runner is active and enable it if needed
    this.ensureModelRunnerEnabled().catch((e) => {});
  }

  /**
   * Checks if Docker Model Runner is running at the expected port
   * and enables it if not running
   */
  private async ensureModelRunnerEnabled(): Promise<void> {
    try {
      // Check if the Model Runner service is running on the expected port
      const isRunning = await this.isPortBound(12434);

      if (!isRunning) {
        console.log(
          "Docker Model Runner not detected. Attempting to enable it...",
        );
        await this.executeDockerCommand([
          "desktop",
          "enable",
          "model-runner",
          "--tcp",
          "12434",
        ]);
        console.log("Docker Model Runner has been enabled on port 12434");
      }
    } catch (error) {
      console.warn("Failed to enable Docker Model Runner:", error);
    }
  }

  /**
   * Checks if a port is currently bound/in use
   */
  private async isPortBound(port: number): Promise<boolean> {
    try {
      await this.fetch(`http://localhost:${port}`, {
        method: "HEAD",
        signal: AbortSignal.timeout(1000),
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  private async executeDockerCommand(
    args: string[],
    signal?: AbortSignal,
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const proc = spawn("docker", args, { shell: true });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(
            new Error(`Docker command failed with code ${code}: ${stderr}`),
          );
        }
      });

      if (signal) {
        signal.addEventListener("abort", () => {
          proc.kill();
          reject(new Error("Docker command was aborted"));
        });
      }
    });
  }

  async listModels(): Promise<string[]> {
    try {
      // Execute docker model ls and parse the output
      const { stdout } = await this.executeDockerCommand([
        "model",
        "ls",
        "--format",
        "{{.Repository}}/{{.Tag}}",
      ]);
      return stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    } catch (error) {
      console.error("Failed to list Docker models:", error);
      throw error;
    }
  }

  async installModel(
    modelName: string,
    signal: AbortSignal,
    progressReporter?: (task: string, increment: number, total: number) => void,
  ): Promise<any> {
    const targetModel = modelName;

    const release = await Docker.modelsBeingInstalledMutex.acquire();
    try {
      if (Docker.modelsBeingInstalled.has(modelName)) {
        throw new Error(`Model '${modelName}' is already being installed.`);
      }
      Docker.modelsBeingInstalled.add(modelName);
    } finally {
      release();
    }

    try {
      // Report starting the installation
      progressReporter?.(`Installing Docker model ${targetModel}`, 0, 100);

      // Pull the model
      const { stdout, stderr } = await this.executeDockerCommand(
        ["model", "pull", targetModel],
        signal,
      );

      // Report completion
      progressReporter?.(
        `Docker model ${targetModel} installed successfully`,
        100,
        100,
      );

      return { success: true, stdout, stderr };
    } catch (error) {
      console.error(`Failed to install Docker model ${targetModel}:`, error);
      // Fix: Type check the error before accessing message property
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to install Docker model ${targetModel}: ${errorMessage}`,
      );
    } finally {
      const release = await Docker.modelsBeingInstalledMutex.acquire();
      try {
        Docker.modelsBeingInstalled.delete(modelName);
      } finally {
        release();
      }
    }
  }

  public async isInstallingModel(modelName: string): Promise<boolean> {
    const release = await Docker.modelsBeingInstalledMutex.acquire();
    try {
      return Docker.modelsBeingInstalled.has(modelName);
    } finally {
      release();
    }
  }
}

export default Docker;
