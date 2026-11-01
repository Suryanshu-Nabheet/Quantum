/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export {
	AGENT_ATTACH_BROWSER_CONTEXT_COMMAND,
	AGENT_BROWSER_CLOSE_PAGE_COMMAND,
	AGENT_BROWSER_ENSURE_SHARED_COMMAND,
	AGENT_BROWSER_GET_OPEN_PAGES_COMMAND,
	AGENT_BROWSER_GET_PAGE_CONTEXT_COMMAND,
	AGENT_BROWSER_INVOKE_TOOL_COMMAND,
	AGENT_BROWSER_NOTIFY_SUBMIT_COMMAND,
	AGENT_BROWSER_SESSION_ID,
	AGENT_BROWSER_TOOL_IDS,
	AgentBrowserToolIds,
	type AgentAttachBrowserContextArgs,
	type AgentBrowserInvokeToolArgs,
	type AgentBrowserPageSummary,
	type AgentBrowserSharingState,
	type AgentBrowserToolId,
} from '../workbench/common/agentBrowserBridge.js';
