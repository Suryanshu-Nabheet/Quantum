import { useCallback, useContext, useEffect, useState } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";

export type ActivityBarOrientation = "vertical" | "horizontal";

interface WorkbenchAppearanceLayout {
  statusBarVisible: boolean;
  activityBarOrientation: ActivityBarOrientation;
}

export function useWorkbenchAppearanceLayout() {
  const ideMessenger = useContext(IdeMessengerContext);
  const [layout, setLayout] = useState<WorkbenchAppearanceLayout | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const result = await ideMessenger.request(
      "workbench/getAppearanceLayout",
      undefined,
    );
    if (result.status === "success") {
      setLayout(result.content);
    }
    setLoading(false);
  }, [ideMessenger]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function setStatusBarVisible(visible: boolean) {
    await ideMessenger.request("workbench/setAppearanceLayout", {
      statusBarVisible: visible,
    });
    setLayout((prev) =>
      prev ? { ...prev, statusBarVisible: visible } : prev,
    );
  }

  async function setActivityBarOrientation(
    orientation: ActivityBarOrientation,
  ) {
    await ideMessenger.request("workbench/setAppearanceLayout", {
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
