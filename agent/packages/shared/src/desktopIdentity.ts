// FILE: desktopIdentity.ts
// Purpose: Defines the canonical desktop application identity across packaging and runtime.

export const QUANTUM_DESKTOP_SCHEME = "quantum";
export const QUANTUM_DESKTOP_ORIGIN = `${QUANTUM_DESKTOP_SCHEME}://app`;
export const QUANTUM_DESKTOP_ENTRY_URL = `${QUANTUM_DESKTOP_ORIGIN}/index.html`;
export const QUANTUM_DESKTOP_UPDATE_CHANNEL = "quantum";
export const QUANTUM_PRODUCTION_BUNDLE_ID = "com.suryanshunabheet.quantum";
export const QUANTUM_DEVELOPMENT_BUNDLE_ID = `${QUANTUM_PRODUCTION_BUNDLE_ID}.dev`;
export const QUANTUM_CANARY_BUNDLE_ID = `${QUANTUM_PRODUCTION_BUNDLE_ID}.canary`;
export const QUANTUM_CANARY_DESKTOP_SCHEME = "quantum-canary";
export const QUANTUM_CANARY_DESKTOP_ORIGIN = `${QUANTUM_CANARY_DESKTOP_SCHEME}://app`;
export const QUANTUM_CANARY_DESKTOP_ENTRY_URL = `${QUANTUM_CANARY_DESKTOP_ORIGIN}/index.html`;

export type QuantumDesktopFlavor = "production" | "development" | "canary";

export interface QuantumDesktopIdentity {
  readonly flavor: QuantumDesktopFlavor;
  readonly displayName: string;
  readonly bundleId: string;
  readonly scheme: string;
  readonly origin: string;
  readonly entryUrl: string;
  readonly userDataDirectoryName: string;
  readonly defaultHomeDirectoryName: string;
  readonly usesScriptedUpdates: boolean;
}

export function resolveQuantumDesktopFlavor(input: {
  readonly isDevelopment: boolean;
  readonly requestedFlavor?: string | undefined;
}): QuantumDesktopFlavor {
  if (input.requestedFlavor?.trim().toLowerCase() === "canary") {
    return "canary";
  }
  return input.isDevelopment ? "development" : "production";
}

export function quantumDesktopIdentity(flavor: QuantumDesktopFlavor): QuantumDesktopIdentity {
  if (flavor === "canary") {
    return {
      flavor,
      displayName: "Quantum Canary",
      bundleId: QUANTUM_CANARY_BUNDLE_ID,
      scheme: QUANTUM_CANARY_DESKTOP_SCHEME,
      origin: QUANTUM_CANARY_DESKTOP_ORIGIN,
      entryUrl: QUANTUM_CANARY_DESKTOP_ENTRY_URL,
      userDataDirectoryName: "quantum-canary",
      defaultHomeDirectoryName: ".quantum-canary",
      usesScriptedUpdates: true,
    };
  }
  if (flavor === "development") {
    return {
      flavor,
      displayName: "Quantum (Dev)",
      bundleId: QUANTUM_DEVELOPMENT_BUNDLE_ID,
      scheme: QUANTUM_DESKTOP_SCHEME,
      origin: QUANTUM_DESKTOP_ORIGIN,
      entryUrl: QUANTUM_DESKTOP_ENTRY_URL,
      userDataDirectoryName: "quantum-dev",
      defaultHomeDirectoryName: ".quantum",
      usesScriptedUpdates: false,
    };
  }
  return {
    flavor,
    displayName: "Quantum",
    bundleId: QUANTUM_PRODUCTION_BUNDLE_ID,
    scheme: QUANTUM_DESKTOP_SCHEME,
    origin: QUANTUM_DESKTOP_ORIGIN,
    entryUrl: QUANTUM_DESKTOP_ENTRY_URL,
    userDataDirectoryName: "quantum",
    defaultHomeDirectoryName: ".quantum",
    usesScriptedUpdates: false,
  };
}

export function quantumBundleId(isDevelopment: boolean): string {
  return quantumDesktopIdentity(isDevelopment ? "development" : "production").bundleId;
}
