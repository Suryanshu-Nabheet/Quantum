import {
  AdjustmentsHorizontalIcon,
  BookOpenIcon,
  CircleStackIcon,
  Cog6ToothIcon,
  CommandLineIcon,
  CubeIcon,
  InformationCircleIcon,
  PencilIcon,
  Squares2X2Icon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { IDE_SETTINGS_LABEL } from "core/util/branding";
import { CONFIG_NAV_ICON_CLASS } from "./configLayout";

export type ConfigNavAction =
  | { type: "tab"; tabId: string }
  | { type: "vscode-settings" }
  | { type: "url"; url: string };

export interface ConfigNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: ConfigNavAction;
  external?: boolean;
}

export interface ConfigNavGroup {
  id: string;
  items: ConfigNavItem[];
}

export const DOCS_URL = "https://github.com/Suryanshu-Nabheet/Quantum";

const navIcon = (Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>) => (
  <Icon className={CONFIG_NAV_ICON_CLASS} />
);

export const configNavGroups: ConfigNavGroup[] = [
  {
    id: "general",
    items: [
      {
        id: "settings",
        label: "General",
        icon: navIcon(Cog6ToothIcon),
        action: { type: "tab", tabId: "settings" },
      },
      {
        id: "vscode-settings",
        label: IDE_SETTINGS_LABEL,
        icon: navIcon(AdjustmentsHorizontalIcon),
        action: { type: "vscode-settings" },
        external: true,
      },
    ],
  },
  {
    id: "agent",
    items: [
      {
        id: "models",
        label: "Models",
        icon: navIcon(CubeIcon),
        action: { type: "tab", tabId: "models" },
      },
      {
        id: "modelRoles",
        label: "Model roles",
        icon: navIcon(Squares2X2Icon),
        action: { type: "tab", tabId: "modelRoles" },
      },
      {
        id: "rules",
        label: "Rules",
        icon: navIcon(PencilIcon),
        action: { type: "tab", tabId: "rules" },
      },
      {
        id: "tools",
        label: "Tools",
        icon: navIcon(WrenchScrewdriverIcon),
        action: { type: "tab", tabId: "tools" },
      },
      {
        id: "mcp",
        label: "MCP",
        icon: navIcon(CircleStackIcon),
        action: { type: "tab", tabId: "mcp" },
      },
      {
        id: "shortcuts",
        label: "Shortcuts",
        icon: navIcon(CommandLineIcon),
        action: { type: "tab", tabId: "shortcuts" },
      },
    ],
  },
];

export const configNavFooter: ConfigNavItem[] = [
  {
    id: "about",
    label: "About",
    icon: navIcon(InformationCircleIcon),
    action: { type: "tab", tabId: "about" },
  },
  {
    id: "docs",
    label: "Docs",
    icon: navIcon(BookOpenIcon),
    action: { type: "url", url: DOCS_URL },
    external: true,
  },
];

export function getActiveTabIdForNavItem(
  item: ConfigNavItem,
  activeTab: string,
): boolean {
  return item.action.type === "tab" && item.action.tabId === activeTab;
}
