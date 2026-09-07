// ProfileHandlers manage the loading of a config, allowing us to abstract over different ways of getting to a AgentConfig

import { ConfigResult } from "agent-config";
import { AgentConfig } from "../../index.js";
import { ProfileDescription } from "../ProfileLifecycleManager.js";

// After we have the AgentConfig, the ConfigHandler takes care of everything else (loading models, lifecycle, etc.)
export interface IProfileLoader {
  description: ProfileDescription;
  doLoadConfig(): Promise<ConfigResult<AgentConfig>>;
  setIsActive(isActive: boolean): void;
}
