/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { encodeBase64 } from '../../../../../base/common/buffer.js';
import { generateUuid } from '../../../../../base/common/uuid.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Action2, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { localize2 } from '../../../../../nls.js';
import { IPlaywrightService } from '../../../../../platform/browserView/common/playwrightService.js';
import { ILanguageModelToolsService, IToolInvocation, IToolResult } from '../../../chat/common/tools/languageModelToolsService.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { BrowserViewSharingState, IBrowserViewWorkbenchService } from '../../../browserView/common/browserView.js';
import {
	AGENT_BROWSER_CLOSE_PAGE_COMMAND,
	AGENT_BROWSER_INVOKE_TOOL_COMMAND,
	AgentBrowserToolIds,
	type AgentBrowserInvokeToolArgs,
	type AgentBrowserPageSummary,
} from '../common/agentBrowserBridge.js';
import { IWorkbenchContribution, WorkbenchPhase, registerWorkbenchContribution2 } from '../../../../common/contributions.js';

function toSharingState(state: BrowserViewSharingState): AgentBrowserPageSummary['sharingState'] {
	switch (state) {
		case BrowserViewSharingState.Shared:
			return 'shared';
		case BrowserViewSharingState.NotShared:
			return 'notShared';
		default:
			return 'unavailable';
	}
}

function getOpenPageSummaries(editorService: IEditorService, browserViewService: IBrowserViewWorkbenchService): AgentBrowserPageSummary[] {
	const activeEditor = editorService.activeEditor;
	const pages: AgentBrowserPageSummary[] = [];

	for (const editor of browserViewService.getKnownBrowserViews().values()) {
		const model = editor.model;
		pages.push({
			id: editor.id,
			title: editor.getTitle(),
			url: editor.url ?? '',
			resource: editor.resource.toString(),
			sharingState: model ? toSharingState(model.sharingState) : 'unavailable',
			isActive: editor === activeEditor,
		});
	}

	return pages;
}

function formatBrowserToolResult(result: IToolResult): string {
	if (result.toolResultError) {
		throw new Error(
			typeof result.toolResultError === 'string'
				? result.toolResultError
				: 'Browser tool failed',
		);
	}

	const parts: string[] = [];
	for (const part of result.content) {
		if (part.kind === 'text') {
			parts.push(part.value);
		} else if (part.kind === 'data') {
			const b64 = encodeBase64(part.value.data);
			parts.push(
				`[Browser screenshot ${part.value.mimeType}]\n` +
				`data:${part.value.mimeType};base64,${b64}`,
			);
		}
	}

	return parts.join('\n\n') || 'Browser tool completed.';
}

registerAction2(class AgentBrowserInvokeToolAction extends Action2 {
	constructor() {
		super({
			id: AGENT_BROWSER_INVOKE_TOOL_COMMAND,
			title: localize2('agentBrowser.invokeTool', "Invoke Agent Browser Tool"),
			f1: false,
		});
	}

	async run(accessor: ServicesAccessor, args?: AgentBrowserInvokeToolArgs): Promise<string> {
		if (!args?.toolId) {
			throw new Error('Browser tool id is required');
		}

		const toolId = args.toolId;
		const parameters = args.parameters ?? {};

		// Agent-native tools that are not registered as Chat LM tools.
		if (toolId === AgentBrowserToolIds.ListOpenPages) {
			const pages = getOpenPageSummaries(
				accessor.get(IEditorService),
				accessor.get(IBrowserViewWorkbenchService),
			);
			if (pages.length === 0) {
				return 'No integrated browser pages are open.';
			}
			return [
				'Open integrated browser pages:',
				...pages.map(p =>
					`- pageId=${p.id} | ${p.title} | ${p.url || 'about:blank'} | sharing=${p.sharingState}${p.isActive ? ' | active' : ''}`,
				),
				'',
				'Share a page (toolbar) or call open_browser_page before read/click/navigate tools.',
			].join('\n');
		}

		if (toolId === AgentBrowserToolIds.CloseBrowserPage) {
			return closeBrowserPage(
				accessor,
				typeof parameters.pageId === 'string' ? parameters.pageId : undefined,
			);
		}

		const toolsService = accessor.get(ILanguageModelToolsService);
		const tool = toolsService.getTool(toolId);
		if (!tool) {
			throw new Error(
				`Browser tool "${toolId}" is not available. Share a browser page with the agent or open the Browser layout first.`,
			);
		}

		const invocation: IToolInvocation = {
			callId: generateUuid(),
			toolId,
			parameters,
			// Agent-native path: no VS Code Chat session. Tool impls use the
			// agent Playwright session id via getSessionId() fallback.
			context: undefined,
		};

		const result = await toolsService.invokeTool(
			invocation,
			async () => 0,
			CancellationToken.None,
		);

		return formatBrowserToolResult(result);
	}
});

async function closeBrowserPage(accessor: ServicesAccessor, pageId: string | undefined): Promise<string> {
	if (!pageId) {
		throw new Error('pageId is required to close a browser page');
	}

	const browserViewService = accessor.get(IBrowserViewWorkbenchService);
	const editorService = accessor.get(IEditorService);
	const playwrightService = accessor.get(IPlaywrightService);

	const editor = browserViewService.getKnownBrowserViews().get(pageId);
	if (!editor) {
		throw new Error(`No integrated browser page found for pageId "${pageId}". Call list_open_pages first.`);
	}

	const title = editor.getTitle();
	const url = editor.url ?? 'about:blank';

	try {
		await playwrightService.stopTrackingPage(pageId);
	} catch {
		// Page may not have been tracked yet.
	}

	const matches = editorService.findEditors(editor.resource);
	if (matches.length > 0) {
		await editorService.closeEditors(matches);
	}

	return `Closed browser page ${pageId} (${title} — ${url}).`;
}

registerAction2(class AgentBrowserClosePageAction extends Action2 {
	constructor() {
		super({
			id: AGENT_BROWSER_CLOSE_PAGE_COMMAND,
			title: localize2('agentBrowser.closePage', "Close Browser Page"),
			f1: false,
		});
	}

	async run(accessor: ServicesAccessor, pageId?: string): Promise<string> {
		return closeBrowserPage(accessor, typeof pageId === 'string' ? pageId : undefined);
	}
});

class AgentBrowserToolsContribution implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.agentBrowserTools';

	constructor() {
		// Commands registered via registerAction2 above.
	}
}

registerWorkbenchContribution2(AgentBrowserToolsContribution.ID, AgentBrowserToolsContribution, WorkbenchPhase.AfterRestored);
