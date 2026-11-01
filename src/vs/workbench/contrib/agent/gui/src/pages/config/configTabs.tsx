import { ConfigSection } from "./components/ConfigSection";
import { KeyboardShortcutsSection } from "./sections/KeyboardShortcutsSection";
import { MCPSection } from "./sections/MCPSection";
import { AgentSettingsSection } from "./sections/AgentSettingsSection";
import { TabSettingsSection } from "./sections/TabSettingsSection";
import { ModelsSection } from "./sections/ModelsSection";
import { RulesSection } from "./sections/RulesSection";
import { UserSettingsSection } from "./sections/UserSettingsSection";
import type { ConfigTab as ConfigTabId } from "../../util/navigation";

export interface ConfigTabEntry {
  id: ConfigTabId;
  component: React.ReactNode;
}

export const configTabs: ConfigTabEntry[] = [
  {
    id: "settings",
    component: (
      <ConfigSection>
        <UserSettingsSection />
      </ConfigSection>
    ),
  },
  {
    id: "models",
    component: (
      <ConfigSection>
        <ModelsSection />
      </ConfigSection>
    ),
  },
  {
    id: "agent",
    component: (
      <ConfigSection>
        <AgentSettingsSection />
      </ConfigSection>
    ),
  },
  {
    id: "tab",
    component: (
      <ConfigSection>
        <TabSettingsSection />
      </ConfigSection>
    ),
  },
  {
    id: "rules",
    component: (
      <ConfigSection>
        <RulesSection />
      </ConfigSection>
    ),
  },
  {
    id: "mcp",
    component: (
      <ConfigSection>
        <MCPSection />
      </ConfigSection>
    ),
  },
  {
    id: "shortcuts",
    component: (
      <ConfigSection>
        <KeyboardShortcutsSection />
      </ConfigSection>
    ),
  },
];
