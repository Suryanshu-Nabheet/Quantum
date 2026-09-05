import { describe, expect, it } from "vitest";

import {
  resolveQuantumDesktopFlavor,
  QUANTUM_CANARY_BUNDLE_ID,
  QUANTUM_CANARY_DESKTOP_ENTRY_URL,
  QUANTUM_CANARY_DESKTOP_ORIGIN,
  QUANTUM_DESKTOP_ENTRY_URL,
  QUANTUM_DESKTOP_ORIGIN,
  QUANTUM_DESKTOP_UPDATE_CHANNEL,
  QUANTUM_DEVELOPMENT_BUNDLE_ID,
  QUANTUM_PRODUCTION_BUNDLE_ID,
  quantumBundleId,
  quantumDesktopIdentity,
} from "./desktopIdentity";

describe("desktopIdentity", () => {
  it("uses the exact canonical production and development bundle IDs", () => {
    expect(QUANTUM_PRODUCTION_BUNDLE_ID).toBe("com.suryanshunabheet.quantum");
    expect(QUANTUM_DEVELOPMENT_BUNDLE_ID).toBe("com.suryanshunabheet.quantum.dev");
    expect(quantumBundleId(false)).toBe(QUANTUM_PRODUCTION_BUNDLE_ID);
    expect(quantumBundleId(true)).toBe(QUANTUM_DEVELOPMENT_BUNDLE_ID);
  });

  it("uses the exact packaged renderer origin and entry URL", () => {
    expect(QUANTUM_DESKTOP_ORIGIN).toBe("quantum://app");
    expect(QUANTUM_DESKTOP_ENTRY_URL).toBe("quantum://app/index.html");
  });

  it("uses the isolated Quantum desktop update channel", () => {
    expect(QUANTUM_DESKTOP_UPDATE_CHANNEL).toBe("quantum");
  });

  it("gives Canary a fully separate desktop identity and storage profile", () => {
    expect(QUANTUM_CANARY_BUNDLE_ID).toBe("com.suryanshunabheet.quantum.canary");
    expect(QUANTUM_CANARY_DESKTOP_ORIGIN).toBe("quantum-canary://app");
    expect(QUANTUM_CANARY_DESKTOP_ENTRY_URL).toBe("quantum-canary://app/index.html");
    expect(quantumDesktopIdentity("canary")).toEqual({
      flavor: "canary",
      displayName: "Quantum Canary",
      bundleId: QUANTUM_CANARY_BUNDLE_ID,
      scheme: "quantum-canary",
      origin: QUANTUM_CANARY_DESKTOP_ORIGIN,
      entryUrl: QUANTUM_CANARY_DESKTOP_ENTRY_URL,
      userDataDirectoryName: "quantum-canary",
      defaultHomeDirectoryName: ".quantum-canary",
      usesScriptedUpdates: true,
    });
  });

  it("selects Canary explicitly without changing normal dev and production defaults", () => {
    expect(resolveQuantumDesktopFlavor({ isDevelopment: false })).toBe("production");
    expect(resolveQuantumDesktopFlavor({ isDevelopment: true })).toBe("development");
    expect(resolveQuantumDesktopFlavor({ isDevelopment: false, requestedFlavor: " canary " })).toBe(
      "canary",
    );
    expect(resolveQuantumDesktopFlavor({ isDevelopment: true, requestedFlavor: "canary" })).toBe(
      "canary",
    );
  });
});
