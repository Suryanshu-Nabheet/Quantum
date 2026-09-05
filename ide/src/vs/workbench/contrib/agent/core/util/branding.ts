/** AI-native IDE (VS Code fork) this extension ships in. */
export const IDE_NAME = "Quantum";

/** In-IDE AI agent (Quantum AI Agent). */
export const AGENT_NAME = "Agent";

/** Integrated settings panel for models, rules, tools, etc. (Cursor-style). */
export const QUANTUM_SETTINGS = "Quantum Settings";

/** Native editor settings UI (keybindings, extension toggles, etc.). */
export const IDE_SETTINGS_LABEL = "Editor Settings";

export function quantumSettingsPath(section: string): string {
  return `${QUANTUM_SETTINGS} → ${section}`;
}
