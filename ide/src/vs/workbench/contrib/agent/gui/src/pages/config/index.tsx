
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { buildConfigRoute, resolveConfigTab } from "../../util/navigation";
import { ConfigSidebar } from "./components/ConfigSidebar";
import {
  CONFIG_CONTENT_MAX_WIDTH,
  CONFIG_CONTENT_SHELL,
} from "./configLayout";
import { configTabs } from "./configTabs";

function ConfigPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const tabParam = searchParams.get("tab");
  const activeTab = resolveConfigTab(tabParam);

  useEffect(() => {
    if (tabParam === null) {
      return;
    }
    const resolved = resolveConfigTab(tabParam);
    if (tabParam !== resolved) {
      navigate(buildConfigRoute(resolved), { replace: true });
    }
  }, [tabParam, navigate]);

  const handleTabClick = (tabId: string) => {
    navigate(buildConfigRoute(resolveConfigTab(tabId)));
  };

  const activeTabContent = configTabs.find((tab) => tab.id === activeTab)
    ?.component;

  return (
    <div className="flex h-full min-h-0 w-full flex-row overflow-hidden">
      <ConfigSidebar activeTab={activeTab} onTabSelect={handleTabClick} />

      <main className="thin-scrollbar relative min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className={CONFIG_CONTENT_SHELL}>
          <div className={CONFIG_CONTENT_MAX_WIDTH}>{activeTabContent}</div>
        </div>
      </main>
    </div>
  );
}

export default ConfigPage;
