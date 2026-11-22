import { randomUUID } from "node:crypto";
import fs from "node:fs";

import { MCPServer, ModelConfig, ModelRole } from "agent-config";

import {
    salvageSharedConfig,
    sharedConfigSchema,
    SharedConfigSchema,
} from "../config/sharedConfig";

import { getGlobalContextFilePath } from "./paths";
import { withAgentStateLock, writeAtomically } from "./stateFile";

export type GlobalContextModelSelections = Partial<
  Record<ModelRole, string | null>
>;

export type GlobalContextType = {
  indexingPaused: boolean;
  lastSelectedProfileForWorkspace: {
    [workspaceIdentifier: string]: string | null;
  };
  selectedModelsByProfileId: {
    [profileId: string]: GlobalContextModelSelections;
  };

  hasShownUnsupportedPlatformWarning: boolean;
  showConfigUpdateToast: boolean;
  sharedConfig: SharedConfigSchema;
  shownDeprecatedProviderWarnings: { [providerTitle: string]: boolean };
  autoUpdateCli: boolean;

  /** Models configured through Settings (GUI). */
  guiModels: ModelConfig[];
  /** MCP servers configured through Settings (GUI). */
  guiMcpServers: MCPServer[];
  /** Rules configured through Settings (GUI). */
  guiRules: StoredGuiRule[];
  /** Slash-command prompts configured through Settings (GUI). */
  guiPrompts: StoredGuiPrompt[];
  hasMigratedLegacyGuiDefinitions: boolean;
};

export interface StoredGuiRule {
  id: string;
  name: string;
  rule: string;
  description?: string;
  globs?: string | string[];
  regex?: string | string[];
  alwaysApply?: boolean;
  invokable?: boolean;
}

export interface StoredGuiPrompt {
  id: string;
  name: string;
  prompt: string;
  description?: string;
  invokable?: boolean;
}

function readIfPresent(filepath: string): string | undefined {
  try {
    const fd = fs.openSync(filepath, "r");
    try {
      const stat = fs.fstatSync(fd);
      if (stat.isFile() && process.platform !== "win32" && (stat.mode & 0o077)) {
        fs.fchmodSync(fd, 0o600);
      }
      return fs.readFileSync(fd, "utf-8");
    } finally {
      fs.closeSync(fd);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

function parseContext(data: string | undefined): Partial<GlobalContextType> | undefined {
  if (data === undefined) {
    return undefined;
  }
  try {
    const value = JSON.parse(data);
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}

function salvageContext(data: string): Partial<GlobalContextType> {
  try {
    const match = data.match(/"sharedConfig"\s*:\s*({[^}]*})/);
    if (match) {
      const sharedConfig = salvageSharedConfig(JSON.parse(match[1]));
      if (Object.keys(sharedConfig).length > 0) {
        return { sharedConfig };
      }
    }
  } catch {
    // The original bytes are retained for manual recovery.
  }
  return {};
}

/**
 * Persists global Agent settings and retains the last readable version.
 */
export class GlobalContext {
  update<T extends keyof GlobalContextType>(
    key: T,
    value: GlobalContextType[T],
  ) {
    return withAgentStateLock(() => {
      const filepath = getGlobalContextFilePath();
      const data = readIfPresent(filepath);
      let context: Partial<GlobalContextType> = {};
      if (data !== undefined) {
        const parsed = parseContext(data);
        if (parsed) {
          writeAtomically(`${filepath}.bak`, data);
          context = parsed;
        } else {
          writeAtomically(`${filepath}.corrupt-${randomUUID()}`, data);
          context = parseContext(readIfPresent(`${filepath}.bak`)) ?? salvageContext(data);
          console.warn("Recovered Agent settings after preserving the corrupted file.");
        }
      }
      context[key] = value;
      writeAtomically(filepath, JSON.stringify(context, null, 2));
    });
  }

  get<T extends keyof GlobalContextType>(
    key: T,
  ): GlobalContextType[T] | undefined {
    const filepath = getGlobalContextFilePath();
    const data = readIfPresent(filepath);
    if (data !== undefined) {
      const context = parseContext(data);
      if (context) {
        return context[key];
      }
      console.warn("Agent settings are corrupted. Reading from the recovery copy.");
      return (parseContext(readIfPresent(`${filepath}.bak`)) ?? salvageContext(data))[key];
    }
  }

  getSharedConfig(): SharedConfigSchema {
    const sharedConfig = this.get("sharedConfig") ?? {};
    const result = sharedConfigSchema.safeParse(sharedConfig);
    if (result.success) {
      return result.data;
    } else {
      // in case of damaged shared config, repair it
      // Attempt to salvage any values that are security concerns
      console.error("Failed to load shared config, salvaging...", result.error);
      const salvagedConfig = salvageSharedConfig(sharedConfig);
      this.update("sharedConfig", salvagedConfig);
      return salvagedConfig;
    }
  }

  updateSharedConfig(
    newValues: Partial<SharedConfigSchema>,
  ): SharedConfigSchema {
    return withAgentStateLock(() => {
      const currentSharedConfig = this.getSharedConfig();
      const updatedSharedConfig = { ...currentSharedConfig, ...newValues };
      this.update("sharedConfig", updatedSharedConfig);
      return updatedSharedConfig;
    });
  }

  updateSelectedModel(
    profileId: string,
    role: ModelRole,
    title: string | null,
  ): GlobalContextModelSelections {
    return withAgentStateLock(() => {
      const currentSelections = this.get("selectedModelsByProfileId") ?? {};
      const forProfile = currentSelections[profileId] ?? {};
      const newSelections = { ...forProfile, [role]: title };

      this.update("selectedModelsByProfileId", {
        ...currentSelections,
        [profileId]: newSelections,
      });
      return newSelections;
    });
  }
}
