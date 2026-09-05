/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action2, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { localize2 } from '../../../../../nls.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { BrowserViewSharingState, IBrowserViewWorkbenchService } from '../../../browserView/common/browserView.js';
import { IPlaywrightService } from '../../../../../platform/browserView/common/playwrightService.js';
import {
	AGENT_BROWSER_ENSURE_SHARED_COMMAND,
	AGENT_BROWSER_GET_OPEN_PAGES_COMMAND,
	AGENT_BROWSER_GET_PAGE_CONTEXT_COMMAND,
	AGENT_BROWSER_SESSION_ID,
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

registerAction2(class AgentBrowserGetOpenPagesAction extends Action2 {
	constructor() {
		super({
			id: AGENT_BROWSER_GET_OPEN_PAGES_COMMAND,
			title: localize2('agentBrowser.getOpenPages', "Get Open Browser Pages"),
			f1: false,
		});
	}

	run(accessor: ServicesAccessor): AgentBrowserPageSummary[] {
		return getOpenPageSummaries(
			accessor.get(IEditorService),
			accessor.get(IBrowserViewWorkbenchService),
		);
	}
});

registerAction2(class AgentBrowserEnsureSharedAction extends Action2 {
	constructor() {
		super({
			id: AGENT_BROWSER_ENSURE_SHARED_COMMAND,
			title: localize2('agentBrowser.ensureShared', "Share Browser Page with Agent"),
			f1: false,
		});
	}

	async run(accessor: ServicesAccessor, browserId?: string): Promise<boolean> {
		const browserViewService = accessor.get(IBrowserViewWorkbenchService);
		const id = typeof browserId === 'string' ? browserId : undefined;
		if (!id) {
			return false;
		}

		const editor = browserViewService.getKnownBrowserViews().get(id);
		const model = editor?.model;
		if (!model || model.sharingState === BrowserViewSharingState.Unavailable) {
			return false;
		}

		if (model.sharingState === BrowserViewSharingState.Shared) {
			return true;
		}

		return model.setSharedWithAgent(true);
	}
});

registerAction2(class AgentBrowserGetPageContextAction extends Action2 {
	constructor() {
		super({
			id: AGENT_BROWSER_GET_PAGE_CONTEXT_COMMAND,
			title: localize2('agentBrowser.getPageContext', "Get Browser Page Context"),
			f1: false,
		});
	}

	async run(accessor: ServicesAccessor, browserId?: string): Promise<string | undefined> {
		if (typeof browserId !== 'string' || !browserId) {
			return undefined;
		}

		const browserViewService = accessor.get(IBrowserViewWorkbenchService);
		const editorService = accessor.get(IEditorService);
		const playwrightService = accessor.get(IPlaywrightService);

		const editor = browserViewService.getKnownBrowserViews().get(browserId);
		if (!editor) {
			return undefined;
		}

		const model = editor.model;
		const title = editor.getTitle();
		const url = editor.url ?? 'about:blank';
		const resource = editor.resource.toString();
		const isActive = editor === editorService.activeEditor;

		if (!model || model.sharingState === BrowserViewSharingState.Unavailable) {
			return [
				`Browser page: ${title}`,
				`URL: ${url}`,
				`Page ID: ${browserId}`,
				`Resource: ${resource}`,
				isActive ? '(active tab)' : '',
				'',
				'Browser tools are unavailable. Open the page in the integrated browser to attach it.',
			].filter(Boolean).join('\n');
		}

		if (model.sharingState !== BrowserViewSharingState.Shared) {
			return [
				`Browser page: ${title}`,
				`URL: ${url}`,
				`Page ID: ${browserId}`,
				`Resource: ${resource}`,
				isActive ? '(active tab)' : '',
				'',
				'This page is not shared with the agent yet. Share it from the browser toolbar to include live page content.',
			].filter(Boolean).join('\n');
		}

		try {
			const summary = await playwrightService.getSummary(AGENT_BROWSER_SESSION_ID, browserId);
			if (summary) {
				return [
					`Browser page: ${title}`,
					`URL: ${url}`,
					`Page ID: ${browserId}`,
					`Resource: ${resource}`,
					isActive ? '(active tab)' : '',
					'',
					summary,
				].filter(Boolean).join('\n');
			}
		} catch {
			// fall through to basic metadata
		}

		return [
			`Browser page: ${title}`,
			`URL: ${url}`,
			`Page ID: ${browserId}`,
			`Resource: ${resource}`,
			isActive ? '(active tab)' : '',
		].filter(Boolean).join('\n');
	}
});

class AgentBrowserContribution implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.agentBrowser';

	constructor() {
		// Commands registered via registerAction2 above.
	}
}

registerWorkbenchContribution2(AgentBrowserContribution.ID, AgentBrowserContribution, WorkbenchPhase.AfterRestored);
