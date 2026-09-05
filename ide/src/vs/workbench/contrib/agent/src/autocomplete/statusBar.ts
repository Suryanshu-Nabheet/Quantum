import { ILLM } from "core";
import * as vscode from "vscode";

import { Battery } from "../util/battery";
import { EXTENSION_NAME } from "../util/constants";
import { PRODUCT_NAME } from "../util/extensionMeta";
import { getMetaKeyLabel } from "../util/util";
import {
  AGENT_WORKSPACE_KEY,
  getAgentWorkspaceConfig,
} from "../util/workspaceConfig";

export enum StatusBarStatus {
  Disabled,
  Enabled,
  Paused,
}

export const quickPickStatusText = (status: StatusBarStatus | undefined) => {
  switch (status) {
    case undefined:
    case StatusBarStatus.Disabled:
      return "$(circle-slash) Disable autocomplete";
    case StatusBarStatus.Enabled:
      return "$(check) Enable autocomplete";
    case StatusBarStatus.Paused:
      return "$(debug-pause) Pause autocomplete";
  }
};

export const getStatusBarStatusFromQuickPickItemLabel = (
  label: string,
): StatusBarStatus | undefined => {
  switch (label) {
    case "$(circle-slash) Disable autocomplete":
      return StatusBarStatus.Disabled;
    case "$(check) Enable autocomplete":
      return StatusBarStatus.Enabled;
    case "$(debug-pause) Pause autocomplete":
      return StatusBarStatus.Paused;
    default:
      return undefined;
  }
};

const statusBarItemText = (
  status: StatusBarStatus | undefined,
  loading?: boolean,
  error?: boolean,
) => {
  if (error) {
    return "$(alert) Agent (config error)";
  }

  let text: string;
  switch (status) {
    case undefined:
      if (loading) {
        text = `$(loading~spin) ${PRODUCT_NAME}`;
      } else {
        text = PRODUCT_NAME;
      }
      break;
    case StatusBarStatus.Disabled:
      text = `$(circle-slash) ${PRODUCT_NAME}`;
      break;
    case StatusBarStatus.Enabled:
      text = `$(check) ${PRODUCT_NAME}`;
      break;
    case StatusBarStatus.Paused:
      text = `$(debug-pause) ${PRODUCT_NAME}`;
      break;
    default:
      text = PRODUCT_NAME;
  }

  return text;
};

const statusBarItemTooltip = (status: StatusBarStatus | undefined) => {
  switch (status) {
    case undefined:
    case StatusBarStatus.Disabled:
      return "Click to enable tab autocomplete";
    case StatusBarStatus.Enabled:
      return "Tab autocomplete is enabled";
    case StatusBarStatus.Paused:
      return "Tab autocomplete is paused";
  }
};

let statusBarStatus: StatusBarStatus | undefined = undefined;
let statusBarItem: vscode.StatusBarItem | undefined = undefined;
let statusBarFalseTimeout: NodeJS.Timeout | undefined = undefined;
let statusBarError: boolean = false;
let configListenerRegistered = false;

export function stopStatusBarLoading() {
  statusBarFalseTimeout = setTimeout(() => {
    setupStatusBar(StatusBarStatus.Enabled, false);
  }, 100);
}

/**
 * Ideally, there should be a single 'status' value without
 * 'loading' and 'error' booleans.
 */
export function setupStatusBar(
  status: StatusBarStatus | undefined,
  loading?: boolean,
  error?: boolean,
) {
  if (loading !== false) {
    clearTimeout(statusBarFalseTimeout);
    statusBarFalseTimeout = undefined;
  }

  // If statusBarItem hasn't been defined yet, create it
  if (!statusBarItem) {
    statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
    );
  }

  if (error !== undefined) {
    statusBarError = error;

    if (status === undefined) {
      status = statusBarStatus;
    }

  }

  statusBarItem.text = statusBarItemText(status, loading, statusBarError);
  statusBarItem.tooltip = statusBarItemTooltip(status ?? statusBarStatus);
  statusBarItem.command = "agent.openTabAutocompleteConfigMenu";

  statusBarItem.show();
  if (status !== undefined) {
    statusBarStatus = status;
  }

  if (!configListenerRegistered) {
    configListenerRegistered = true;
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(AGENT_WORKSPACE_KEY)) {
        const enabled = getAgentWorkspaceConfig().get<boolean>(
          "enableTabAutocomplete",
          true,
        );
        if (enabled && statusBarStatus === StatusBarStatus.Paused) {
          return;
        }
        setupStatusBar(
          enabled ? StatusBarStatus.Enabled : StatusBarStatus.Disabled,
        );
      }
    });
  }
}

export function getStatusBarStatus(): StatusBarStatus | undefined {
  return statusBarStatus;
}

export function monitorBatteryChanges(battery: Battery): vscode.Disposable {
  const initialConfig = vscode.workspace.getConfiguration(EXTENSION_NAME);
  if (
    initialConfig.get<boolean>("enableTabAutocomplete", true) &&
    initialConfig.get<boolean>("pauseTabAutocompleteOnBattery")
  ) {
    battery.startPolling();
  }

  return battery.onChangeAC((acConnected: boolean) => {
    const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
    const enabled = config.get<boolean>("enableTabAutocomplete", true);
    if (!!enabled) {
      const pauseOnBattery = config.get<boolean>(
        "pauseTabAutocompleteOnBattery",
      );
      setupStatusBar(
        acConnected || !pauseOnBattery
          ? StatusBarStatus.Enabled
          : StatusBarStatus.Paused,
      );
    }
  });
}

export function getAutocompleteStatusBarDescription(
  selected: string | undefined,
  { title, apiKey, providerName }: ILLM,
): string | undefined {
  if (title !== selected) {
    return undefined;
  }

  let description = "Current autocomplete model";

  // Only set for Mistral since our default config includes Codestral without
  // an API key
  if ((apiKey === undefined || apiKey === "") && providerName === "mistral") {
    description += " (Missing API key)";
  }

  return description;
}

export function getAutocompleteStatusBarTitle(
  selected: string | undefined,
  { title }: ILLM,
): string {
  if (!title) {
    return "Unnamed Model";
  }

  if (title === selected) {
    return `$(check) ${title}`;
  }

  return title;
}

