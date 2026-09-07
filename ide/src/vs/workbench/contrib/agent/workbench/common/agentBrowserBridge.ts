/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Playwright session id used when Agent reads shared browser pages. */
export const AGENT_BROWSER_SESSION_ID = 'agent';

export const AGENT_BROWSER_GET_OPEN_PAGES_COMMAND = 'agent.browser.getOpenPages';
export const AGENT_BROWSER_GET_PAGE_CONTEXT_COMMAND = 'agent.browser.getPageContext';
export const AGENT_BROWSER_ENSURE_SHARED_COMMAND = 'agent.browser.ensureShared';
export const AGENT_BROWSER_CLOSE_PAGE_COMMAND = 'agent.browser.closePage';
export const AGENT_BROWSER_INVOKE_TOOL_COMMAND = 'agent.browser.invokeTool';
export const AGENT_ATTACH_BROWSER_CONTEXT_COMMAND = 'agent.attachBrowserContext';
export const AGENT_BROWSER_NOTIFY_SUBMIT_COMMAND = 'agent.browser.notifySubmit';

/** Tool ids shared with VS Code Chat browser LM tools (see browserTools.contribution). */
export const AgentBrowserToolIds = {
	OpenBrowserPage: 'open_browser_page',
	ListOpenPages: 'list_open_pages',
	CloseBrowserPage: 'close_browser_page',
	ReadPage: 'read_page',
	ScreenshotPage: 'screenshot_page',
	NavigatePage: 'navigate_page',
	ClickElement: 'click_element',
	TypeInPage: 'type_in_page',
	HoverElement: 'hover_element',
	DragElement: 'drag_element',
	RunPlaywrightCode: 'run_playwright_code',
	HandleDialog: 'handle_dialog',
} as const;

export type AgentBrowserToolId = typeof AgentBrowserToolIds[keyof typeof AgentBrowserToolIds];

export const AGENT_BROWSER_TOOL_IDS: readonly AgentBrowserToolId[] = Object.values(AgentBrowserToolIds);

export interface AgentBrowserInvokeToolArgs {
	readonly toolId: AgentBrowserToolId | string;
	readonly parameters: Record<string, unknown>;
}

export type AgentBrowserSharingState = 'shared' | 'notShared' | 'unavailable';

export interface AgentBrowserPageSummary {
	readonly id: string;
	readonly title: string;
	readonly url: string;
	readonly resource: string;
	readonly sharingState: AgentBrowserSharingState;
	readonly isActive: boolean;
}

export interface AgentAttachBrowserContextArgs {
	readonly name: string;
	readonly description: string;
	readonly content: string;
	readonly uri?: string;
	readonly providerTitle?: string;
}
