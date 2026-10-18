import { vi, test, expect, beforeEach } from "vitest";
import { QUANTUM_SETTINGS_SCHEME } from "../../config/guiUris";
import { createRuleBlockImpl } from "./createRuleBlock";

const mockExtras = {
  ide: {
    getWorkspaceDirs: vi.fn<() => Promise<string[]>>().mockResolvedValue(["/"]),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

test("createRuleBlockImpl stores rule in Settings and returns uri", async () => {
  const args = {
    name: "TypeScript Rule",
    rule: "Use interfaces for object shapes",
    description: "Always use interfaces",
    alwaysApply: true,
    globs: "**/*.{ts,tsx}",
  };

  const result = await createRuleBlockImpl(args, mockExtras as any);

  expect(result[0].content).toContain("Settings");
  expect(result[0].uri?.value).toMatch(
    new RegExp(`^${QUANTUM_SETTINGS_SCHEME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}rule/`),
  );
});

test("createRuleBlockImpl does not write markdown files", async () => {
  const writeFile = vi.fn();
  const extras = {
    ide: {
      getWorkspaceDirs: vi
        .fn<() => Promise<string[]>>()
        .mockResolvedValue(["/"]),
      writeFile,
      openFile: vi.fn(),
    },
  };

  await createRuleBlockImpl(
    {
      name: "Special Ch@racters & Spaces",
      rule: "Handle special characters",
      description: "Test rule",
      alwaysApply: false,
    },
    extras as any,
  );

  expect(writeFile).not.toHaveBeenCalled();
});
