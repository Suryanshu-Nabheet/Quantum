import {
	DocumentTextIcon,
	GlobeAltIcon,
	ListBulletIcon,
} from "@heroicons/react/24/outline";
import { BuiltInToolNames } from "core/tools/builtIn";
import { describe, expect, it } from "vitest";
import { getToolCallIcon } from "./utils";

describe("getToolCallIcon", () => {
	it("uses the configured semantic icon for todo updates", () => {
		expect(getToolCallIcon(BuiltInToolNames.WriteTodos)).toBe(ListBulletIcon);
	});

	it("resolves semantic icons for tool kinds without configured icons", () => {
		expect(getToolCallIcon(BuiltInToolNames.ReadSkill)).toBeUndefined();
		expect(getToolCallIcon("read_page", "Browser")).toBe(DocumentTextIcon);
	});

	it("uses feature icons for browser tools and no generic or MCP icon", () => {
		expect(getToolCallIcon("custom_browser_tool", "Browser")).toBe(
			GlobeAltIcon,
		);
		expect(getToolCallIcon("custom_mcp_tool", "MCP: Files")).toBeUndefined();
		expect(getToolCallIcon("custom_tool")).toBeUndefined();
		expect(getToolCallIcon(BuiltInToolNames.ViewDiff)).toBeUndefined();
		expect(getToolCallIcon(BuiltInToolNames.RunTerminalCommand)).toBeUndefined();
	});
});
