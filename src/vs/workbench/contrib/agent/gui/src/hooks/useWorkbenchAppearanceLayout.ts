import { useCallback, useContext, useEffect, useState } from "react";
import { HostBridgeContext } from "../context/HostBridge";

export type ActivityBarOrientation = "vertical" | "horizontal";

interface WorkbenchAppearanceLayout {
  statusBarVisible: boolean;
  activityBarOrientation: ActivityBarOrientation;
}

export function useWorkbenchAppearanceLayout() {
  const hostBridge = useContext(HostBridgeContext);
  const [layout, setLayout] = useState<WorkbenchAppearanceLayout | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const result = await hostBridge.request(
      "workbench/getAppearanceLayout",
      undefined,
    );
    if (result.status === "success") {
      setLayout(result.content);
    }
    setLoading(false);
  }, [hostBridge]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function setStatusBarVisible(visible: boolean) {
    await hostBridge.request("workbench/setAppearanceLayout", {
      statusBarVisible: visible,
    });
    setLayout((prev) =>
      prev ? { ...prev, statusBarVisible: visible } : prev,
    );
  }

  async function setActivityBarOrientation(
    orientation: ActivityBarOrientation,
  ) {
    await hostBridge.request("workbench/setAppearanceLayout", {
      activityBarOrientation: orientation,
    });
    setLayout((prev) =>
      prev ? { ...prev, activityBarOrientation: orientation } : prev,
    );
  }

  return {
    layout,
    loading,
    refresh,
    setStatusBarVisible,
    setActivityBarOrientation,
  };
}
