// FILE: quantumHome.ts
// Purpose: Resolves the user-level Quantum base directory without Effect, so the backend
// server and the Electron main process agree on one location during early startup.
// Exports: expandHomePath, resolveQuantumHomeDirectory, QUANTUM_HOME_ENV_NAME.

import * as OS from "node:os";
import * as Path from "node:path";

export const QUANTUM_HOME_ENV_NAME = "QUANTUM_HOME";
export const DEFAULT_QUANTUM_HOME_DIRECTORY_NAME = ".quantum";

/** Expands a leading `~` against the user's home directory; other inputs pass through. */
export function expandHomePath(input: string, homeDirectory: string = OS.homedir()): string {
  if (input === "~") {
    return homeDirectory;
  }
  if (input.startsWith("~/") || input.startsWith("~\\")) {
    return Path.join(homeDirectory, input.slice(2));
  }
  return input;
}

/**
 * Resolves the Quantum base directory the same way for every process in the install.
 */
export function resolveQuantumHomeDirectory(
  options: {
    /** Explicit override; falls back to `QUANTUM_HOME` or `QUANTUM_HOME` from `env`. */
    readonly configuredHome?: string | undefined;
    readonly env?: NodeJS.ProcessEnv;
    readonly homeDirectory?: string;
    /** Flavor-specific default (`.quantum-canary`), used only when nothing is configured. */
    readonly directoryName?: string;
  } = {},
): string {
  const homeDirectory = options.homeDirectory ?? OS.homedir();
  const env = options.env ?? process.env;
  const configured = (options.configuredHome ?? env.QUANTUM_HOME ?? env.QUANTUM_HOME)?.trim();
  if (!configured) {
    return Path.join(homeDirectory, options.directoryName ?? DEFAULT_QUANTUM_HOME_DIRECTORY_NAME);
  }
  return Path.resolve(expandHomePath(configured, homeDirectory));
}
