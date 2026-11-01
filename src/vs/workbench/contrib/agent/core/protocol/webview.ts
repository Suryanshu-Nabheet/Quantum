import { ConfigResult } from "agent-config";

import { ProfileDescription } from "../config/ProfileLifecycleManager";
import type {
  BrowserSerializedAgentConfig,
  ContextItemWithId,
  ContextProviderName,
} from "../index.js";

export type ToWebviewFromIdeOrCoreProtocol = {
  configUpdate: [
    {
      result: ConfigResult<BrowserSerializedAgentConfig>;
      profileId: string | null;
      profiles: ProfileDescription[];
    },
    void,
  ];
  getDefaultModelTitle: [undefined, string | undefined];
  refreshSubmenuItems: [
    {
      providers: "all" | ContextProviderName[];
    },
    void,
  ];
  didCloseFiles: [{ uris: string[] }, void];
  isAgentInputFocused: [undefined, boolean];
  addContextItem: [
    {
      historyIndex: number;
      item: ContextItemWithId;
    },
    void,
  ];
  setTTSActive: [boolean, void];
  getWebviewHistoryLength: [undefined, number];
  getCurrentSessionId: [undefined, string];

  sessionUpdate: [{ sessionInfo: any }, void];
  toolCallPartialOutput: [{ toolCallId: string; contextItems: any[] }, void];
};
