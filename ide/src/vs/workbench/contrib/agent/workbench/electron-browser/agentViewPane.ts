/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getWindow } from '../../../../../base/browser/dom.js';
import { generateUuid } from '../../../../../base/common/uuid.js';
import { URI } from '../../../../../base/common/uri.js';
import { INativeEnvironmentService } from '../../../../../platform/environment/common/environment.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { ViewPane } from '../../../../browser/parts/views/viewPane.js';
import { IViewletViewOptions } from '../../../../browser/parts/views/viewsViewlet.js';
import { IViewDescriptorService } from '../../../../common/views.js';
import { IOverlayWebview, IWebviewService, WebviewContentPurpose } from '../../../webview/browser/webview.js';
import { asWebviewUri, webviewGenericCspSource } from '../../../webview/common/webview.js';
import { AGENT_GUI_VIEW_ID } from '../../shared/ids.js';
import { IAgentNativeService } from './agentNativeService.js';
import { IAgentWorkbenchHost } from './agentWorkbenchHost.js';

export class AgentViewPane extends ViewPane {
	private webview: IOverlayWebview | undefined;
	private bodyContainer: HTMLElement | undefined;
	private readonly nonce = generateUuid();
	private guiReady = false;

	constructor(
		options: IViewletViewOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService private readonly agentConfigurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@IWebviewService private readonly webviewService: IWebviewService,
		@INativeEnvironmentService private readonly environmentService: INativeEnvironmentService,
		@IAgentNativeService private readonly agentService: IAgentNativeService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
		@IEditorService private readonly editorService: IEditorService,
		@IAgentWorkbenchHost private readonly agentWorkbenchHost: IAgentWorkbenchHost,
	) {
		super(options, keybindingService, contextMenuService, agentConfigurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
		agentService.registerGuiRequestHandler((messageType, data) => this.requestGui(messageType, data));
		agentService.registerGuiMessageSender((messageType, data) => {
			const messageId = generateUuid();
			this.trackMessageAck(this.pendingWorkbenchGuiAcks, messageId);
			this.postOrQueueGuiMessage({ messageType, data, messageId });
		});
		this._register(this.editorService.onDidActiveEditorChange(() => {
			const resource = this.editorService.activeEditor?.resource;
			if (this.runtimeStarted && resource) {
				void this.agentService.invoke({ id: generateUuid(), messageType: 'files/opened', data: { uris: [resource.toString()] } });
			}
		}));
		this._register(this.agentConfigurationService.onDidChangeConfiguration(event => {
			if (this.runtimeStarted && event.affectsConfiguration('agent')) {
				void this.agentService.invoke({ id: generateUuid(), messageType: 'config/ideSettingsUpdate', data: {} });
			}
		}));
		this._register(agentService.onDidReceiveCoreMessage(message => this.postCoreMessageToGui(message)));
		this._register(agentService.onDidReceiveRuntimeChunk(chunk => {
			const messageType = this.invocationTypes.get(chunk.messageId);
			if (messageType) {
				this.postOrQueueGuiMessage({
					messageType,
					messageId: chunk.messageId,
					data: { done: false, content: chunk.content, status: 'success' },
				});
			}
		}));
		this._register(this.onDidChangeBodyVisibility(() => this.updateVisibility()));
	}

	private readonly invocationTypes = new Map<string, string>();
	private readonly pendingCoreMessageAcks = new Set<string>();
	private readonly pendingWorkbenchGuiAcks = new Set<string>();
	private readonly queuedGuiMessages: unknown[] = [];
	private runtimeStarted = false;
	private readonly pendingGuiRequests = new Map<string, { resolve(value: unknown): void; reject(error: Error): void; timeout: ReturnType<typeof setTimeout> }>();

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		this.bodyContainer = container;
		this.createWebview();
		this.layoutWebview();
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.layoutWebview();
	}

	override focus(): void {
		super.focus();
		this.webview?.focus();
	}

	override dispose(): void {
		for (const request of this.pendingGuiRequests.values()) {
			clearTimeout(request.timeout);
			request.reject(new Error('Agent view closed before the request completed.'));
		}
		this.pendingGuiRequests.clear();
		this.invocationTypes.clear();
		this.pendingCoreMessageAcks.clear();
		this.pendingWorkbenchGuiAcks.clear();
		this.guiReady = false;
		this.webview?.release(this);
		this.webview?.dispose();
		this.webview = undefined;
		super.dispose();
	}

	private createWebview(): void {
		if (this.webview) {
			return;
		}
		const guiRoot = URI.file(`${this.environmentService.agentRuntimePath}/webview`);
		const scriptUri = asWebviewUri(URI.joinPath(guiRoot, 'assets', 'index.js'));
		const styleUri = asWebviewUri(URI.joinPath(guiRoot, 'assets', 'index.css'));
		const webview = this.webviewService.createWebviewOverlay({
			providedViewType: AGENT_GUI_VIEW_ID,
			title: this.title,
			options: { purpose: WebviewContentPurpose.WebviewView, retainContextWhenHidden: true },
			contentOptions: {
				allowScripts: true,
				localResourceRoots: [guiRoot],
			},
			extension: undefined,
		});
		this.webview = this._register(webview);
		this._register(webview.onMessage(event => void this.handleGuiMessage(event.message)));
		webview.setHtml(`<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${this.nonce}' ${webviewGenericCspSource} 'unsafe-eval'; style-src 'unsafe-inline' ${webviewGenericCspSource}; img-src ${webviewGenericCspSource} https: data: blob:; font-src ${webviewGenericCspSource} data:; connect-src https: http://localhost:5173 ws://localhost:5173;">
<link rel="stylesheet" href="${styleUri}"><title>Quantum Agent</title></head>
<body class="sidebar"><div id="root"></div>
<script nonce="${this.nonce}">const vscode = acquireVsCodeApi(); window.vscMediaUrl = ${JSON.stringify(asWebviewUri(guiRoot).toString() + '/')}; window.ide = 'vscode'; window.windowId = ${JSON.stringify(generateUuid())}; window.workspacePaths = ${JSON.stringify(this.workspaceContextService.getWorkspace().folders.map(folder => folder.uri.toString()))}; window.workbenchHoverDelay = 500;</script>
<script type="module" nonce="${this.nonce}" src="${scriptUri}"></script></body></html>`);
		this.updateVisibility();
	}

	private async handleGuiMessage(message: unknown): Promise<void> {
		if (!message || typeof message !== 'object') {
			return;
		}
		const request = message as { messageType?: unknown; messageId?: unknown; data?: unknown };
		if (typeof request.messageType !== 'string' || typeof request.messageId !== 'string') {
			return;
		}
		if (request.messageType === 'agentGuiReady') {
			this.guiReady = true;
			for (const queued of this.queuedGuiMessages.splice(0)) {
				void this.webview?.postMessage(queued);
			}
			return;
		}
		const pending = this.pendingGuiRequests.get(request.messageId);
		if (pending) {
			this.pendingGuiRequests.delete(request.messageId);
			clearTimeout(pending.timeout);
			const response = request.data as { done?: boolean; content?: unknown; error?: string } | undefined;
			if (response?.error) {
				pending.reject(new Error(response.error));
			} else if (response?.done !== false) {
				pending.resolve(response?.content);
			}
			return;
		}
		if (this.pendingCoreMessageAcks.delete(request.messageId)) {
			return;
		}
		if (this.pendingWorkbenchGuiAcks.delete(request.messageId)) {
			return;
		}
		this.invocationTypes.set(request.messageId, request.messageType);
		try {
			const nativeRequest = this.agentWorkbenchHost.handleGuiRequest(request.messageType, request.data);
			const result = nativeRequest.handled
				? await nativeRequest.value
				: await this.agentService.invoke({ id: request.messageId, messageType: request.messageType, data: request.data });
			this.runtimeStarted = true;
			await this.webview?.postMessage({ messageType: request.messageType, messageId: request.messageId, data: { done: true, content: result, status: 'success' } });
		} catch (error) {
			await this.webview?.postMessage({
				messageType: request.messageType,
				messageId: request.messageId,
				data: { done: true, error: error instanceof Error ? error.message : String(error), status: 'error' },
			});
		} finally {
			this.invocationTypes.delete(request.messageId);
		}
	}

	private postCoreMessageToGui(message: unknown): void {
		const messageId = (message as { messageId?: unknown } | undefined)?.messageId;
		if (typeof messageId === 'string') {
			this.trackMessageAck(this.pendingCoreMessageAcks, messageId);
		}
		this.postOrQueueGuiMessage(message);
	}

	private trackMessageAck(pending: Set<string>, messageId: string): void {
		if (pending.size >= 256) {
			const oldest = pending.values().next().value;
			if (oldest) {
				pending.delete(oldest);
			}
		}
		pending.add(messageId);
	}

	private requestGui(messageType: string, data: unknown): Promise<unknown> {
		const webview = this.webview;
		if (!webview) {
			return Promise.reject(new Error('Agent GUI is not available.'));
		}
		const messageId = generateUuid();
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.pendingGuiRequests.delete(messageId);
				reject(new Error(`Agent GUI request timed out: ${messageType}`));
			}, 15_000);
			this.pendingGuiRequests.set(messageId, { resolve, reject, timeout });
			this.postOrQueueGuiMessage({ messageType, data, messageId });
		});
	}

	private postOrQueueGuiMessage(message: unknown): void {
		if (this.webview && this.guiReady) {
			void this.webview.postMessage(message);
		} else {
			this.queuedGuiMessages.push(message);
		}
	}

	private updateVisibility(): void {
		if (!this.webview) {
			return;
		}
		if (this.isBodyVisible()) {
			this.webview.claim(this, getWindow(this.element), this.scopedContextKeyService);
		} else {
			this.webview.release(this);
		}
	}

	private layoutWebview(): void {
		if (this.bodyContainer && this.webview) {
			this.webview.setAnchorElement(this.bodyContainer, this.bodyContainer);
		}
	}
}
