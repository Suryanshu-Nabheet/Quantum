import * as os from "node:os";

import * as vscode from "vscode";

import { EXTENSION_ID } from "./extensionMeta";

type Platform = "mac" | "linux" | "windows" | "unknown";
type Architecture = "x64" | "arm64" | "unknown";

export function getPlatform(): Platform {
  const platform = os.platform();
  if (platform === "darwin") {
    return "mac";
  } else if (platform === "linux") {
    return "linux";
  } else if (platform === "win32") {
    return "windows";
  } else {
    return "unknown";
  }
}

function getArchitecture(): Architecture {
  const arch = os.arch();
  if (arch === "x64" || arch === "ia32") {
    return "x64";
  } else if (arch === "arm64" || arch === "arm") {
    return "arm64";
  } else {
    return "unknown";
  }
}

export function isUnsupportedPlatform(): {
  isUnsupported: boolean;
  reason?: string;
} {
  const platform = getPlatform();
  const arch = getArchitecture();

  if (platform === "windows" && arch === "arm64") {
    return {
      isUnsupported: true,
      reason:
        "Windows ARM64 is not currently supported due to missing native dependencies (onnxruntime). Please use Quantum Agent on Windows x64, macOS, or Linux instead.",
    };
  }

  // if (platform === "unknown" || arch === "unknown") {
  //   return {
  //     isUnsupported: true,
  //     reason: `Unsupported platform combination: ${os.platform()}-${os.arch()}. Quantum Agent supports Windows x64, macOS (Intel/Apple Silicon), and Linux (x64/ARM64).`,
  //   };
  // }

  return { isUnsupported: false };
}

export function getMetaKeyLabel() {
  const platform = getPlatform();
  switch (platform) {
    case "mac":
      return "⌘";
    case "linux":
    case "windows":
      return "Ctrl";
    default:
      return "Ctrl";
  }
}

export function getMetaKeyName() {
  const platform = getPlatform();
  switch (platform) {
    case "mac":
      return "Cmd";
    case "linux":
    case "windows":
      return "Ctrl";
    default:
      return "Ctrl";
  }
}

export function getExtensionVersion(): string {
  const extension = vscode.extensions.getExtension(EXTENSION_ID);
  return extension?.packageJSON.version || "1.0.0";
}

export function getvsCodeUriScheme(): string {
  return vscode.env.uriScheme;
}

export function isExtensionPrerelease(): boolean {
  const extensionVersion = getExtensionVersion();
  const versionParts = extensionVersion.split(".");
  if (versionParts.length >= 2) {
    const minorVersion = parseInt(versionParts[1], 10);
    if (!isNaN(minorVersion)) {
      return minorVersion % 2 !== 0;
    }
  }
  return false;
}
