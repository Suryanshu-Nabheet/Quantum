/** Browser-safe Quantum Settings URI helpers (no Node/fs deps). */

export const QUANTUM_SETTINGS_SCHEME = "quantum-settings://";

export function quantumSettingsRuleUri(id: string): string {
  return `${QUANTUM_SETTINGS_SCHEME}rule/${id}`;
}

export function quantumSettingsPromptUri(id: string): string {
  return `${QUANTUM_SETTINGS_SCHEME}prompt/${id}`;
}

export function quantumSettingsMcpUri(name: string): string {
  return `${QUANTUM_SETTINGS_SCHEME}mcp/${encodeURIComponent(name)}`;
}

export function parseQuantumSettingsRuleId(
  sourceFile?: string,
): string | undefined {
  const prefix = `${QUANTUM_SETTINGS_SCHEME}rule/`;
  if (!sourceFile?.startsWith(prefix)) {
    return undefined;
  }
  return sourceFile.slice(prefix.length);
}

export function parseQuantumSettingsPromptId(
  sourceFile?: string,
): string | undefined {
  const prefix = `${QUANTUM_SETTINGS_SCHEME}prompt/`;
  if (!sourceFile?.startsWith(prefix)) {
    return undefined;
  }
  return sourceFile.slice(prefix.length);
}
