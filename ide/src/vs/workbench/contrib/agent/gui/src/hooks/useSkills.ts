import type { FromWebviewProtocol } from "core/protocol";
import { useCallback, useContext, useEffect, useState } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";

export type DetectedSkill = FromWebviewProtocol["config/listSkills"][1][number];

/**
 * Loads skills auto-detected from the workspace and global agent folders.
 * Skills are not part of the serialized config, so they are fetched on demand
 * and can be refreshed after a new skill file is created.
 */
export function useSkills() {
  const ideMessenger = useContext(IdeMessengerContext);
  const [skills, setSkills] = useState<DetectedSkill[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await ideMessenger.request("config/listSkills", undefined);
      if (response.status === "success") {
        setSkills(response.content);
      }
    } finally {
      setIsLoading(false);
    }
  }, [ideMessenger]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { skills, isLoading, refresh };
}
