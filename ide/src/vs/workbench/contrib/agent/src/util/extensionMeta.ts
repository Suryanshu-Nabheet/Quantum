import {
  AGENT_NAME,
  IDE_NAME,
  IDE_SETTINGS_LABEL,
  QUANTUM_SETTINGS,
} from "core/util/branding";
import { AGENT_EXTENSION_ID } from "../../shared/ids";

/** Built-in Quantum Agent runtime identity — keep in sync with package.json name */
export const EXTENSION_NAME = "agent";
export const EXTENSION_ID = AGENT_EXTENSION_ID;

export const PRODUCT_NAME = AGENT_NAME;
export { IDE_NAME, QUANTUM_SETTINGS, IDE_SETTINGS_LABEL };
