import { ConfigSection } from "./components/ConfigSection";
import { AboutSection } from "./sections/AboutSection";
import { KeyboardShortcutsSection } from "./sections/KeyboardShortcutsSection";
import { MCPSection } from "./sections/MCPSection";
import { ModelRolesSection } from "./sections/ModelRolesSection";
import { ModelsSection } from "./sections/ModelsSection";
import { RulesSection } from "./sections/RulesSection";
import { ToolsSection } from "./sections/ToolsSection";
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
    id: "modelRoles",
    component: (
      <ConfigSection>
        <ModelRolesSection />
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
    id: "tools",
    component: (
      <ConfigSection>
        <ToolsSection />
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
  {
    id: "about",
    component: (
      <ConfigSection>
        <AboutSection />
      </ConfigSection>
    ),
  },
];
