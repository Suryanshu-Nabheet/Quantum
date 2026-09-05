import { useContext } from "react";
import { cn } from "../../../util/cn";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import {
  ConfigNavItem,
  configNavFooter,
  configNavGroups,
  getActiveTabIdForNavItem,
} from "../configNav";
import {
  CONFIG_SIDEBAR_EDGE,
  CONFIG_SIDEBAR_WIDTH,
  CONFIG_SIDEBAR_X,
  CONFIG_TOP_INSET,
} from "../configLayout";
import { ConfigSidebarCell } from "./ConfigSidebarCell";

interface ConfigSidebarProps {
  activeTab: string;
  onTabSelect: (tabId: string) => void;
}

function ConfigSidebarDivider() {
  return (
    <hr className="my-1.5 w-full border-0 border-t border-solid border-t-[color:var(--vscode-sideBar-border,rgba(128,128,128,0.22))]" />
  );
}

function renderNavCell(
  item: ConfigNavItem,
  activeTab: string,
  onSelect: (item: ConfigNavItem) => void,
) {
  return (
    <ConfigSidebarCell
      key={item.id}
      label={item.label}
      icon={item.icon}
      external={item.external}
      isActive={getActiveTabIdForNavItem(item, activeTab)}
      tabId={item.action.type === "tab" ? item.action.tabId : undefined}
      onClick={() => onSelect(item)}
    />
  );
}

export function ConfigSidebar({ activeTab, onTabSelect }: ConfigSidebarProps) {
  const ideMessenger = useContext(IdeMessengerContext);

  const handleNavItem = (item: ConfigNavItem) => {
    switch (item.action.type) {
      case "tab":
        onTabSelect(item.action.tabId);
        break;
      case "vscode-settings":
        ideMessenger.post("openVscodeSettings", undefined);
        break;
      case "url":
        ideMessenger.post("openUrl", item.action.url);
        break;
    }
  };

  return (
    <nav
      aria-label="Settings"
      className={cn(
        "bg-vsc-background flex h-full max-h-full shrink-0 flex-col overflow-hidden text-sm transition-[width] duration-200 ease-out",
        CONFIG_SIDEBAR_EDGE,
        CONFIG_SIDEBAR_WIDTH,
      )}
    >
      <div
        className={cn(
          "thin-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden",
          CONFIG_TOP_INSET,
          CONFIG_SIDEBAR_X,
          "pb-2",
        )}
      >
        {configNavGroups.map((group, groupIndex) => (
          <div key={group.id}>
            {groupIndex > 0 && <ConfigSidebarDivider />}
            <div className="flex flex-col gap-px">
              {group.items.map((item) =>
                renderNavCell(item, activeTab, handleNavItem),
              )}
            </div>
          </div>
        ))}
      </div>

      <div className={cn("shrink-0", CONFIG_SIDEBAR_X, "pb-2.5")}>
        <ConfigSidebarDivider />
        <div className="flex flex-col gap-px">
          {configNavFooter.map((item) =>
            renderNavCell(item, activeTab, handleNavItem),
          )}
        </div>
      </div>
    </nav>
  );
}
