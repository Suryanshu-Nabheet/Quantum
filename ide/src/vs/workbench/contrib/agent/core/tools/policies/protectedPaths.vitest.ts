import { describe, expect, it } from "vitest";
import { BuiltInToolNames } from "../builtIn";
import { applyAgentAccessModes } from "./agentAccess";
import {
  applyProtectedPathPolicy,
  DEFAULT_PROTECTED_FILE_PATTERNS,
} from "./protectedPaths";

describe("applyProtectedPathPolicy", () => {
  it("requires approval for writes to .env in full-auto policy", () => {
    expect(
      applyProtectedPathPolicy(
        BuiltInToolNames.EditExistingFile,
        "allowedWithoutPermission",
        "apps/web/.env",
        DEFAULT_PROTECTED_FILE_PATTERNS,
        { requireReadApproval: true },
      ),
    ).toBe("allowedWithPermission");
  });

  it("does not downgrade disabled policies", () => {
    expect(
      applyProtectedPathPolicy(
        BuiltInToolNames.EditExistingFile,
        "disabled",
        ".env",
        DEFAULT_PROTECTED_FILE_PATTERNS,
        { requireReadApproval: true },
      ),
    ).toBe("disabled");
  });

  it("ignores non-matching paths", () => {
    expect(
      applyProtectedPathPolicy(
        BuiltInToolNames.EditExistingFile,
        "allowedWithoutPermission",
        "src/index.ts",
        DEFAULT_PROTECTED_FILE_PATTERNS,
        { requireReadApproval: true },
      ),
    ).toBe("allowedWithoutPermission");
  });

  it("requires read approval on protected files when enabled", () => {
    expect(
      applyProtectedPathPolicy(
        BuiltInToolNames.ReadFile,
        "allowedWithoutPermission",
        "config/.env.local",
        DEFAULT_PROTECTED_FILE_PATTERNS,
        { requireReadApproval: true },
      ),
    ).toBe("allowedWithPermission");
  });

  it("stays protected after Full access elevates workspace file policy", () => {
    let policy = applyAgentAccessModes(
      BuiltInToolNames.EditExistingFile,
      "allowedWithoutPermission",
      "full",
      "auto",
    );
    policy = applyProtectedPathPolicy(
      BuiltInToolNames.EditExistingFile,
      policy,
      "apps/api/.env",
      DEFAULT_PROTECTED_FILE_PATTERNS,
      { requireReadApproval: true },
    );
    expect(policy).toBe("allowedWithPermission");
  });

  it("allows auto read when read approval is off", () => {
    expect(
      applyProtectedPathPolicy(
        BuiltInToolNames.ReadFile,
        "allowedWithoutPermission",
        ".env",
        DEFAULT_PROTECTED_FILE_PATTERNS,
        { requireReadApproval: false },
      ),
    ).toBe("allowedWithoutPermission");
  });
});
