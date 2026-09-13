// Valid config tab names
export type ConfigTab =
  | "models"
  | "modelRoles"
  | "rules"
  | "access"
  | "mcp"
  | "settings"
  | "shortcuts"
  | "about";

export const ROUTES = {
  HOME: "/",
  HOME_INDEX: "/index.html",
  CONFIG: "/config",
};

export const buildConfigRoute = (tab?: ConfigTab): string => {
  return tab ? `${ROUTES.CONFIG}?tab=${tab}` : ROUTES.CONFIG;
};

export const CONFIG_ROUTES = {
  MODELS: buildConfigRoute("models"),
  MODEL_ROLES: buildConfigRoute("modelRoles"),
  RULES: buildConfigRoute("rules"),
  ACCESS: buildConfigRoute("access"),
  MCP: buildConfigRoute("mcp"),
  SETTINGS: buildConfigRoute("settings"),
  SHORTCUTS: buildConfigRoute("shortcuts"),
  ABOUT: buildConfigRoute("about"),
} as const;

const DEFAULT_CONFIG_TAB: ConfigTab = "settings";

/** Legacy query values map to current tab ids. */
const CONFIG_TAB_ALIASES: Record<string, ConfigTab> = {
  help: "about",
  roles: "modelRoles",
  "model-roles": "modelRoles",
  tools: "access",
};

/** Resolve a raw `?tab=` query value to a valid settings tab id. */
export function resolveConfigTab(tabParam: string | null): ConfigTab {
  if (!tabParam) {
    return DEFAULT_CONFIG_TAB;
  }
  const alias = CONFIG_TAB_ALIASES[tabParam];
  if (alias) {
    return alias;
  }
  const validTabs: ConfigTab[] = [
    "models",
    "modelRoles",
    "rules",
    "access",
    "mcp",
    "settings",
    "shortcuts",
    "about",
  ];
  if (validTabs.includes(tabParam as ConfigTab)) {
    return tabParam as ConfigTab;
  }
  return DEFAULT_CONFIG_TAB;
}
