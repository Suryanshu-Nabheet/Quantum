import { describe, expect, it } from "vitest";
import { BuiltInToolNames } from "../builtIn";
import { applyAgentAccessModes } from "./agentAccess";

describe("applyAgentAccessModes", () => {
  it("keeps hard disabled policies", () => {
    expect(
      applyAgentAccessModes(
        BuiltInToolNames.RunTerminalCommand,
        "disabled",
        "full",
        "auto",
      ),
    ).toBe("disabled");
  });

  it("auto-approves terminal in Full + Run Everything", () => {
    expect(
      applyAgentAccessModes(
        BuiltInToolNames.RunTerminalCommand,
        "allowedWithPermission",
        "full",
        "auto",
      ),
    ).toBe("allowedWithoutPermission");
  });

  it("auto-approves terminal in Sandboxed + Run Everything", () => {
    expect(
      applyAgentAccessModes(
        BuiltInToolNames.RunTerminalCommand,
        "allowedWithPermission",
        "sandboxed",
        "auto",
      ),
    ).toBe("allowedWithoutPermission");
  });

  it("always asks for terminal in Strict access", () => {
    expect(
      applyAgentAccessModes(
        BuiltInToolNames.RunTerminalCommand,
        "allowedWithoutPermission",
        "strict",
        "auto",
      ),
    ).toBe("allowedWithPermission");
  });

  it("always asks for terminal when Ask Every Time is selected", () => {
    expect(
      applyAgentAccessModes(
        BuiltInToolNames.RunTerminalCommand,
        "allowedWithoutPermission",
        "full",
        "ask",
      ),
    ).toBe("allowedWithPermission");
  });

  it("keeps security evaluation for allowlist mode", () => {
    expect(
      applyAgentAccessModes(
        BuiltInToolNames.RunTerminalCommand,
        "allowedWithPermission",
        "sandboxed",
        "allowlist",
      ),
    ).toBe("allowedWithPermission");
  });

  it("auto-approves outside-workspace file access in Full mode", () => {
    expect(
      applyAgentAccessModes(
        BuiltInToolNames.ReadFile,
        "allowedWithPermission",
        "full",
        "auto",
      ),
    ).toBe("allowedWithoutPermission");
  });

  it("blocks outside-workspace file access in Strict mode", () => {
    expect(
      applyAgentAccessModes(
        BuiltInToolNames.ReadFile,
        "allowedWithPermission",
        "strict",
        "auto",
      ),
    ).toBe("disabled");
  });

  it("keeps ask for outside-workspace files in Sandboxed mode", () => {
    expect(
      applyAgentAccessModes(
        BuiltInToolNames.ReadFile,
        "allowedWithPermission",
        "sandboxed",
        "auto",
      ),
    ).toBe("allowedWithPermission");
  });
});
