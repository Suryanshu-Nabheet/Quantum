import { EnhancedStore } from "@reduxjs/toolkit";
import { BrowserSerializedAgentConfig, ModelDescription } from "core";
import { copyOf } from "core/util";
import { MockHostBridge } from "../../context/MockHostBridge";

interface TestConfigUpdateParams {
  store: EnhancedStore;
  hostBridge: MockHostBridge;
  newProfileId?: string;
  editConfig?: (
    current: BrowserSerializedAgentConfig,
  ) => BrowserSerializedAgentConfig;
}

export function triggerConfigUpdate({
  store,
  hostBridge,
  editConfig,
  newProfileId,
}: TestConfigUpdateParams) {
  const state = store.getState();
  hostBridge.mockMessageToWebview("configUpdate", {
    profileId: newProfileId ?? (state as any).profiles.selectedProfileId,
    result: {
      config: editConfig
        ? editConfig(copyOf((state as any).config.config))
        : (state as any).config.config,
      configLoadInterrupted: false,
      errors: [],
    },
  });
}

export function addAndSelectChatModel(
  store: EnhancedStore,
  hostBridge: MockHostBridge,
  llmDesc: ModelDescription,
) {
  triggerConfigUpdate({
    store,
    hostBridge,
    editConfig(current) {
      current.modelsByRole.chat.push(llmDesc);
      current.selectedModelByRole.chat = llmDesc;
      return current;
    },
  });
}

export function addAndSelectMockLlm(
  store: EnhancedStore,
  hostBridge: MockHostBridge,
) {
  addAndSelectChatModel(store, hostBridge, {
    model: "mock",
    provider: "mock",
    title: "Mock LLM",
    underlyingProviderName: "mock",
  });
}
