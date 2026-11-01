/** AI-native IDE (VS Code fork) this extension ships in. */
export const IDE_NAME = "Quantum";

/** In-IDE AI agent (Quantum AI Agent). */
export const AGENT_NAME = "Agent";

/** Integrated settings panel for models, rules, tools, etc. */
export const QUANTUM_SETTINGS = "Settings";

/** Native workbench / VS Code settings UI (keybindings, extension toggles, etc.). */
export const IDE_SETTINGS_LABEL = "VS Code Settings";

export function quantumSettingsPath(section: string): string {
  return `${QUANTUM_SETTINGS} → ${section}`;
}
