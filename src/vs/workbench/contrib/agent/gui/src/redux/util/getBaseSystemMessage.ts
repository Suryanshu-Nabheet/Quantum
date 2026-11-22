import { ModelDescription, Tool } from "core";
import {
  buildAssistantIdentityBlock,
  DEFAULT_AGENT_SYSTEM_MESSAGE,
  DEFAULT_CHAT_SYSTEM_MESSAGE,
  DEFAULT_PLAN_SYSTEM_MESSAGE,
} from "core/llm/defaultSystemMessages";
import { getModelDisplayId, getProviderDisplayName } from "../../util/modelDisplay";
import { CUSTOM_OPENAI_PROVIDER_ID_PREFIX } from "../../util/customProvider";

export const NO_TOOL_WARNING =
  "\n\nTHE USER HAS NOT PROVIDED ANY TOOLS, DO NOT ATTEMPT TO USE ANY TOOLS. STOP AND LET THE USER KNOW THAT THERE ARE NO TOOLS AVAILABLE. The user can enable tools under Settings → Agent and Settings → MCP.";

export function getBaseSystemMessage(
  messageMode: string,
  model: ModelDescription,
  activeTools?: Tool[],
  currentUserPrompt = "",
): string {
  let baseMessage: string;

  if (messageMode === "agent") {
    baseMessage = model.baseAgentSystemMessage ?? DEFAULT_AGENT_SYSTEM_MESSAGE;
  } else if (messageMode === "plan") {
    baseMessage = model.basePlanSystemMessage ?? DEFAULT_PLAN_SYSTEM_MESSAGE;
  } else {
    baseMessage = model.baseChatSystemMessage ?? DEFAULT_CHAT_SYSTEM_MESSAGE;
  }

  // Add no-tools warning for agent/plan modes when no tools are available
  if (messageMode !== "chat" && (!activeTools || activeTools.length === 0)) {
    baseMessage += NO_TOOL_WARNING;
  }

  const providerId = model.underlyingProviderName || model.provider || "";
  const asksAboutProvider =
    /\b(?:what|which)\s+(?:(?:is|are)\s+)?(?:the\s+)?(?:configured\s+|active\s+)?provider\b|\bprovider\s+(?:are|is)\s+(?:this|the model|configured|being used|active)\b/i.test(
      currentUserPrompt,
    );
  const asksForModelIdentifier =
    /\b(?:model\s+(?:id|identifier)|(?:exact|full|raw)\s+(?:model\s+)?(?:id|identifier))\b/i.test(
      currentUserPrompt,
    );
  const identity = buildAssistantIdentityBlock(
    {
      modelName:
        model.model || model.title ? getModelDisplayId(model) : undefined,
      providerName:
        asksAboutProvider && providerId
          ? getProviderDisplayName(providerId)
          : undefined,
      modelId: asksForModelIdentifier ? model.model : undefined,
      isCustomProvider:
        asksAboutProvider &&
        providerId
          .toLowerCase()
          .startsWith(CUSTOM_OPENAI_PROVIDER_ID_PREFIX),
    },
    messageMode === "agent" || messageMode === "plan" || messageMode === "chat"
      ? messageMode
      : "chat",
  );
  return `${identity}\n\n${baseMessage}`;
}
