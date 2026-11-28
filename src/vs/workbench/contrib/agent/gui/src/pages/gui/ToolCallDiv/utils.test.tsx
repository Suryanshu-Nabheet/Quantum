import {
	BookOpenIcon,
	DocumentTextIcon,
	GlobeAltIcon,
	ListBulletIcon,
	PuzzlePieceIcon,
	WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { BuiltInToolNames } from "core/tools/builtIn";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GroupedToolCallHeader } from "./GroupedToolCallHeader";
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

describe("GroupedToolCallHeader", () => {
	it("toggles once when its icon is clicked and exposes its expanded state", () => {
		const onToggle = vi.fn();
		const { container } = render(
			<GroupedToolCallHeader toolCallStates={[]} activeCalls={[]} open={true} onToggle={onToggle} />,
		);
		expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
		fireEvent.click(container.querySelector("svg")!);
		expect(onToggle).toHaveBeenCalledTimes(1);
	});
});
