import {
	BookOpenIcon,
	DocumentTextIcon,
	GlobeAltIcon,
	ListBulletIcon,
	PuzzlePieceIcon,
	WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { BuiltInToolNames } from "core/tools/builtIn";
import { describe, expect, it } from "vitest";
import { getToolCallIcon } from "./utils";

describe("getToolCallIcon", () => {
	it("uses the configured semantic icon for todo updates", () => {
		expect(getToolCallIcon(BuiltInToolNames.WriteTodos)).toBe(ListBulletIcon);
	});

	it("resolves semantic icons for tool kinds without configured icons", () => {
		expect(getToolCallIcon(BuiltInToolNames.ReadSkill)).toBe(BookOpenIcon);
		expect(getToolCallIcon("read_page", "Browser")).toBe(DocumentTextIcon);
	});

	it("uses group icons for browser and MCP tools and a stable fallback", () => {
		expect(getToolCallIcon("custom_browser_tool", "Browser")).toBe(
			GlobeAltIcon,
		);
		expect(getToolCallIcon("custom_mcp_tool", "MCP: Files")).toBe(
			PuzzlePieceIcon,
		);
		expect(getToolCallIcon("custom_tool")).toBe(WrenchScrewdriverIcon);
	});
});
