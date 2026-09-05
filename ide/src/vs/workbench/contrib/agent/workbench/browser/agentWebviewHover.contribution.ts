/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getWindow } from '../../../../../base/browser/dom.js';
import { IDisposable } from '../../../../../base/common/lifecycle.js';
import { Action2, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { HoverPosition } from '../../../../../base/browser/ui/hover/hoverWidget.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';
import { IViewsService } from '../../../../services/views/common/viewsService.js';
import { ViewPane } from '../../../../browser/parts/views/viewPane.js';
import { AGENT_GUI_VIEW_ID } from '../../shared/ids.js';

export const AGENT_SHOW_WEBVIEW_HOVER_COMMAND = 'agent.internal.showWebviewHover';
export const AGENT_HIDE_WEBVIEW_HOVER_COMMAND = 'agent.internal.hideWebviewHover';

export type AgentWebviewHoverPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface AgentWebviewHoverArgs {
	viewId?: string;
	content: string;
	rect: {
		x: number;
		y: number;
		width: number;
		height: number;
	};
	placement?: AgentWebviewHoverPlacement;
}

const PLACEMENT_TO_HOVER_POSITION: Record<AgentWebviewHoverPlacement, HoverPosition> = {
	top: HoverPosition.ABOVE,
	bottom: HoverPosition.BELOW,
	left: HoverPosition.LEFT,
	right: HoverPosition.RIGHT,
};

let hoverWidget: IDisposable | undefined;
let proxyTarget: HTMLElement | undefined;

function hideAgentWebviewHover(hoverService: IHoverService): void {
	hoverService.hideHover(true);
	hoverWidget?.dispose();
	hoverWidget = undefined;
	proxyTarget?.remove();
	proxyTarget = undefined;
}

function getAgentWebviewAnchorRect(
	viewsService: IViewsService,
	viewId: string,
): DOMRect | undefined {
	const view = viewsService.getViewWithId(viewId) as ViewPane | null;
	if (!view?.element) {
		return undefined;
	}

	const paneBody = view.element.querySelector('.pane-body') as HTMLElement | null;
	if (paneBody) {
		return paneBody.getBoundingClientRect();
	}

	return view.element.getBoundingClientRect();
}

function showAgentWebviewHover(
	hoverService: IHoverService,
	viewsService: IViewsService,
	args: AgentWebviewHoverArgs,
): void {
	hideAgentWebviewHover(hoverService);

	const viewId = args.viewId ?? AGENT_GUI_VIEW_ID;
	const anchorRect = getAgentWebviewAnchorRect(viewsService, viewId);
	if (!anchorRect) {
		return;
	}

	const placement = args.placement ?? 'top';
	const targetWindow = getWindow(document.body);

	const proxy = targetWindow.document.createElement('div');
	proxy.style.position = 'fixed';
	proxy.style.left = `${anchorRect.left + args.rect.x}px`;
	proxy.style.top = `${anchorRect.top + args.rect.y}px`;
	proxy.style.width = `${Math.max(args.rect.width, 1)}px`;
	proxy.style.height = `${Math.max(args.rect.height, 1)}px`;
	proxy.style.pointerEvents = 'none';
	proxy.style.opacity = '0';
	proxy.style.zIndex = '0';
	targetWindow.document.body.appendChild(proxy);
	proxyTarget = proxy;

	const hover = hoverService.showInstantHover({
		content: args.content,
		target: proxy,
		appearance: {
			compact: true,
			showPointer: true,
		},
		position: {
			hoverPosition: PLACEMENT_TO_HOVER_POSITION[placement],
		},
		persistence: {
			hideOnHover: false,
		},
	});

	if (hover) {
		hoverWidget = hover;
	}
}

registerAction2(class AgentShowWebviewHoverAction extends Action2 {
	constructor() {
		super({
			id: AGENT_SHOW_WEBVIEW_HOVER_COMMAND,
			title: { value: 'Show Agent Webview Hover', original: 'Show Agent Webview Hover' },
			f1: false,
		});
	}

	run(accessor: ServicesAccessor, args: AgentWebviewHoverArgs): void {
		showAgentWebviewHover(
			accessor.get(IHoverService),
			accessor.get(IViewsService),
			args,
		);
	}
});

registerAction2(class AgentHideWebviewHoverAction extends Action2 {
	constructor() {
		super({
			id: AGENT_HIDE_WEBVIEW_HOVER_COMMAND,
			title: { value: 'Hide Agent Webview Hover', original: 'Hide Agent Webview Hover' },
			f1: false,
		});
	}

	run(accessor: ServicesAccessor): void {
		hideAgentWebviewHover(accessor.get(IHoverService));
	}
});
