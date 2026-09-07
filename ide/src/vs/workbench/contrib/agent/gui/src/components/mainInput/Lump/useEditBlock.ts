import { RuleMetadata } from "core";
import { quantumSettingsPath } from "core/util/branding";
import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import {
  buildConfigRoute,
  type ConfigTab,
} from "../../../util/navigation";

function useOpenConfigTab(tab: ConfigTab) {
  const navigate = useNavigate();
  return () => navigate(buildConfigRoute(tab));
}

/** Opens the in-app Settings UI (never raw config YAML). */
export function useEditBlock(tab: ConfigTab = "models") {
  return useOpenConfigTab(tab);
}

/** Navigate to Models settings (e.g. from chat error UI). */
export function useEditModel() {
  return useOpenConfigTab("models");
}

export function useEditDoc() {
  return useOpenConfigTab("models");
}

export function useOpenRule() {
  const navigate = useNavigate();
  const ideMessenger = useContext(IdeMessengerContext);
  return (rule: RuleMetadata) => {
    if (
      rule.source === "default-chat" ||
      rule.source === "default-plan" ||
      rule.source === "default-agent"
    ) {
      ideMessenger.post("showToast", [
        "info",
        `Built-in system messages cannot be edited. Add a custom rule in ${quantumSettingsPath("Rules")} to override them.`,
      ]);
      return;
    }

    if (rule.source === "quantum-settings") {
      navigate(buildConfigRoute("rules"));
      return;
    }

    if (rule.sourceFile && rule.source === "agentFile") {
      void ideMessenger.ide.openFile(rule.sourceFile);
      return;
    }

    navigate(buildConfigRoute("rules"));
  };
}
