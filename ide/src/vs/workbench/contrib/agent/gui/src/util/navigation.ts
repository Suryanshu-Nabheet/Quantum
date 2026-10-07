// Valid config tab names
export type ConfigTab =
  | "models"
  | "agent"
  | "tab"
  | "rules"
  | "mcp"
  | "settings"
  | "shortcuts"
  | "about";

export const VALID_CONFIG_TABS: readonly ConfigTab[] = [
  "models",
  "agent",
  "tab",
  "rules",
  "mcp",
  "settings",
  "shortcuts",
  "about",
];

export const DEFAULT_CONFIG_TAB: ConfigTab = "settings";

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
  AGENT: buildConfigRoute("agent"),
  TAB: buildConfigRoute("tab"),
  RULES: buildConfigRoute("rules"),
  MCP: buildConfigRoute("mcp"),
  SETTINGS: buildConfigRoute("settings"),
  SHORTCUTS: buildConfigRoute("shortcuts"),
  ABOUT: buildConfigRoute("about"),
} as const;

export function isConfigTab(value: string): value is ConfigTab {
  return (VALID_CONFIG_TABS as readonly string[]).includes(value);
}

/** Resolve `?tab=` to a valid settings tab id. Unknown values fall back to General. */
export function resolveConfigTab(tabParam: string | null): ConfigTab {
  if (tabParam && isConfigTab(tabParam)) {
    return tabParam;
  }
  return DEFAULT_CONFIG_TAB;
}
