import { AgentUIConfig, ExperimentalConfig } from "..";

/** @internal Legacy configs may still store UI prefs under experimental. */
type LegacyExperimentalFields = {
  readResponseTTS?: boolean;
};

export type UiPreferenceSource = {
  ui?: AgentUIConfig;
  experimental?: (ExperimentalConfig & LegacyExperimentalFields) | LegacyExperimentalFields;
};

export function getReadResponseTTS(config: UiPreferenceSource): boolean {
  const legacy = config.experimental as LegacyExperimentalFields | undefined;
  return config.ui?.readResponseTTS ?? legacy?.readResponseTTS ?? false;
}
