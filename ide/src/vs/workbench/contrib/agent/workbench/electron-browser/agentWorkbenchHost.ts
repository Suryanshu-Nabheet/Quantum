/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { encodeBase64, VSBuffer } from '../../../../../base/common/buffer.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { ITextResourceEditorInput } from '../../../../../platform/editor/common/editor.js';
import { IWorkbenchEnvironmentService } from '../../../../services/environment/common/environmentService.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { ISecretStorageService } from '../../../../../platform/secrets/common/secrets.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { IAgentNativeService } from './agentNativeService.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IClipboardService } from '../../../../../platform/clipboard/common/clipboardService.js';
import { ICodeEditorService } from '../../../../../editor/browser/services/codeEditorService.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ITextFileService } from '../../../../services/textfile/common/textfiles.js';
import { ISearchService } from '../../../../services/search/common/search.js';
import { QueryBuilder } from '../../../../services/search/common/queryBuilder.js';
import { IMarkerService } from '../../../../../platform/markers/common/markers.js';
import { EditorsOrder } from '../../../../common/editor.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { relativePath } from '../../../../../base/common/resources.js';
import { ITerminalService } from '../../../terminal/browser/terminal.js';
import { IDebugService } from '../../../debug/common/debug.js';
import { ISCMService, ISCMResource } from '../../../scm/common/scm.js';
import { IUntitledTextResourceEditorInput } from '../../../../common/editor.js';
import { linesDiffComputers } from '../../../../../editor/common/diff/linesDiffComputers.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { generateUuid } from '../../../../../base/common/uuid.js';
import { INativeEnvironmentService } from '../../../../../platform/environment/common/environment.js';
import { ACTIVE_GROUP, IEditorService } from '../../../../services/editor/common/editorService.js';
import { IWebviewWorkbenchService } from '../../../webviewPanel/browser/webviewWorkbenchService.js';
import { WebviewInput } from '../../../webviewPanel/browser/webviewEditorInput.js';
import { asWebviewUri, webviewGenericCspSource } from '../../../webview/common/webview.js';
import {
	AGENT_BROWSER_ENSURE_SHARED_COMMAND,
	AGENT_BROWSER_GET_OPEN_PAGES_COMMAND,
	AGENT_BROWSER_GET_PAGE_CONTEXT_COMMAND,
	AGENT_BROWSER_INVOKE_TOOL_COMMAND,
	AGENT_BROWSER_NOTIFY_SUBMIT_COMMAND,
} from '../common/agentBrowserBridge.js';

export interface IAgentWorkbenchHost {
	readonly _serviceBrand: undefined;
	handleGuiRequest(messageType: string, payload: unknown): { handled: boolean; value?: unknown };
	openSettingsPage(route?: string): void;
}

export const IAgentWorkbenchHost = createDecorator<IAgentWorkbenchHost>('agentWorkbenchHost');

const MAX_AGENT_DIFF_FILES = 100;
const MAX_AGENT_DIFF_BYTES = 900 * 1024;
const MAX_AGENT_DIFF_FILE_BYTES = 1024 * 1024;
const AGENT_DIFF_CONCURRENCY = 8;

const NATIVE_IDE_OPERATIONS = new Set([
	'getIdeInfo', 'getWorkspaceDirs', 'isWorkspaceRemote', 'getIdeSettings', 'isTelemetryEnabled', 'getUniqueId',
	'readSecrets', 'writeSecrets', 'fileExists', 'readFile', 'writeFile', 'removeFile', 'readRangeInFile',
	'getFileStats', 'getFileResults', 'getSearchResults', 'listDir', 'openFile', 'showLines', 'saveFile',
	'getOpenFiles', 'getPinnedFiles', 'getCurrentFile', 'getClipboardContent', 'getProblems', 'showToast', 'openUrl',
	'showVirtualFile', 'runCommand', 'readFileAsDataUrl', 'getDiff', 'getTerminalContents',
	'getDebugLocals', 'getTopLevelCallStackSources', 'getAvailableThreads', 'getBranch', 'getRepoName', 'getGitRootPath',
	'getGitRefs', 'getGitHistory', 'getGitCommitContext',
	'gotoDefinition', 'gotoTypeDefinition', 'getSignatureHelp', 'getReferences', 'getDocumentSymbols',
	'getBrowserPages', 'getBrowserPageContext', 'ensureBrowserPageShared', 'invokeBrowserTool', 'notifyAgentBrowserSubmit',
	'reportError', 'closeSidebar',
]);

/** Implements IDE operations on the workbench side of the native runtime boundary. */
export class AgentWorkbenchHost extends Disposable {
	declare readonly _serviceBrand: undefined;
	constructor(
		@IAgentNativeService private readonly agentService: IAgentNativeService,
		@INativeEnvironmentService private readonly nativeEnvironmentService: INativeEnvironmentService,
		@IWorkbenchEnvironmentService private readonly environmentService: IWorkbenchEnvironmentService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
		@IFileService private readonly fileService: IFileService,
		@IProductService private readonly productService: IProductService,
		@INotificationService private readonly notificationService: INotificationService,
		@IEditorService private readonly editorService: IEditorService,
		@IOpenerService private readonly openerService: IOpenerService,
		@ISecretStorageService private readonly secretStorageService: ISecretStorageService,
		@ICommandService private readonly commandService: ICommandService,
		@IClipboardService private readonly clipboardService: IClipboardService,
		@ICodeEditorService private readonly codeEditorService: ICodeEditorService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ITextFileService private readonly textFileService: ITextFileService,
		@ISearchService private readonly searchService: ISearchService,
		@IMarkerService private readonly markerService: IMarkerService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IEditorGroupsService private readonly editorGroupsService: IEditorGroupsService,
		@ITerminalService private readonly terminalService: ITerminalService,
		@IDebugService private readonly debugService: IDebugService,
		@ISCMService private readonly scmService: ISCMService,
		@IWebviewWorkbenchService private readonly webviewWorkbenchService: IWebviewWorkbenchService,
	) {
		super();
		this.queryBuilder = instantiationService.createInstance(QueryBuilder);
		agentService.registerHostRequestHandler(request => this.handleRequest(request.requestKind, request.messageType, request.data));
		this._register(agentService.onDidReceiveRuntimeChunk(chunk => {
			const messageType = this.settingsInvocationTypes.get(chunk.messageId);
			if (messageType && this.settingsEditor && !this.settingsEditor.isDisposed()) {
				void this.settingsEditor.webview.postMessage({
					messageType,
					messageId: chunk.messageId,
					data: { done: false, content: chunk.content, status: 'success' },
				});
			}
		}));
	}

	private readonly queryBuilder: QueryBuilder;
	private settingsEditor: WebviewInput | undefined;
	private readonly settingsInvocationTypes = new Map<string, string>();

	openSettingsPage(route = '/config'): void {
		const existingEditor = this.settingsEditor;
		if (existingEditor && !existingEditor.isDisposed()) {
			this.webviewWorkbenchService.revealWebview(existingEditor, ACTIVE_GROUP, false);
			void existingEditor.webview.postMessage({ messageType: 'navigateTo', data: { path: route }, messageId: generateUuid() });
			return;
		}

		const guiRoot = URI.file(`${this.nativeEnvironmentService.agentRuntimePath}/webview`);
		const input = this.webviewWorkbenchService.openWebview({
			providedViewType: 'quantum.agent.settings',
			title: 'Quantum Settings',
			options: { retainContextWhenHidden: true, enableFindWidget: true },
			contentOptions: { allowScripts: true, localResourceRoots: [guiRoot] },
			extension: undefined,
		}, 'quantum.agent.settings', 'Quantum Settings', Codicon.settingsGear, { group: ACTIVE_GROUP, preserveFocus: false });
		this.settingsEditor = input;
		const listener = input.webview.onMessage(event => void this.handleSettingsEditorMessage(input, event.message));
		const disposeListener = input.onWillDispose(() => {
			listener.dispose();
			disposeListener.dispose();
			if (this.settingsEditor === input) {
				this.settingsEditor = undefined;
				this.settingsInvocationTypes.clear();
			}
		});
		input.webview.setHtml(this.createSettingsEditorHtml(guiRoot, route));
	}

	private createSettingsEditorHtml(guiRoot: URI, route: string): string {
		const nonce = generateUuid();
		const scriptUri = asWebviewUri(URI.joinPath(guiRoot, 'assets', 'index.js'));
		const styleUri = asWebviewUri(URI.joinPath(guiRoot, 'assets', 'index.css'));
		const mediaBaseUrl = `${asWebviewUri(guiRoot).toString()}/`;
		const workspacePaths = this.workspaceContextService.getWorkspace().folders.map(folder => folder.uri.toString());
		return `<!doctype html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' ${webviewGenericCspSource} 'unsafe-eval'; style-src 'unsafe-inline' ${webviewGenericCspSource}; img-src ${webviewGenericCspSource} https: data: blob:; font-src ${webviewGenericCspSource} data:; connect-src https: http://localhost:5173 ws://localhost:5173;">
	<link rel="stylesheet" href="${styleUri}">
	<title>Quantum Settings</title>
</head>
<body class="full-screen">
	<div id="root"></div>
	<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		window.vscMediaUrl = ${JSON.stringify(mediaBaseUrl)};
		window.ide = 'vscode';
		window.windowId = ${JSON.stringify(generateUuid())};
		window.workspacePaths = ${JSON.stringify(workspacePaths)};
		window.workbenchHoverDelay = 500;
		window.isFullScreen = true;
		window.initialRoute = ${JSON.stringify(route)};
	</script>
	<script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
	}

	private async handleSettingsEditorMessage(input: WebviewInput, message: unknown): Promise<void> {
		if (!message || typeof message !== 'object') {
			return;
		}
		const request = message as { messageType?: unknown; messageId?: unknown; data?: unknown };
		if (typeof request.messageType !== 'string' || typeof request.messageId !== 'string') {
			return;
		}
		this.settingsInvocationTypes.set(request.messageId, request.messageType);
		try {
			const nativeRequest = this.handleGuiRequest(request.messageType, request.data);
			const result = nativeRequest.handled
				? await nativeRequest.value
				: await this.agentService.invoke({ id: request.messageId, messageType: request.messageType, data: request.data });
			await input.webview.postMessage({ messageType: request.messageType, messageId: request.messageId, data: { done: true, content: result, status: 'success' } });
		} catch (error) {
			await input.webview.postMessage({ messageType: request.messageType, messageId: request.messageId, data: { done: true, error: error instanceof Error ? error.message : String(error), status: 'error' } });
		} finally {
			this.settingsInvocationTypes.delete(request.messageId);
		}
	}

	handleGuiRequest(messageType: string, payload: unknown): { handled: boolean; value?: unknown } {
		if (NATIVE_IDE_OPERATIONS.has(messageType)) {
			return { handled: true, value: this.handleRequest('ide', messageType, payload) };
		}
		const data = payload as Record<string, unknown> | undefined;
		switch (messageType) {
			case 'showFile':
				return { handled: true, value: this.editorService.openEditor({ resource: this.toResource(data?.filepath) }) };
			case 'focusEditor':
				return { handled: true, value: this.commandService.executeCommand('workbench.action.focusActiveEditorGroup') };
			case 'reloadWindow':
				return { handled: true, value: this.commandService.executeCommand('workbench.action.reloadWindow') };
			case 'toggleDevTools':
				return { handled: true, value: this.commandService.executeCommand('workbench.action.toggleDevTools') };
			case 'openVscodeSettings':
				return { handled: true, value: this.commandService.executeCommand('workbench.action.openSettings') };
			case 'openConfigPage':
				this.openSettingsPage(typeof payload === 'string' ? payload : '/config');
				return { handled: true, value: undefined };
			case 'openKeyboardShortcuts':
				return { handled: true, value: this.commandService.executeCommand('workbench.action.openGlobalKeybindings') };
			case 'openUrl':
				return { handled: true, value: this.openerService.open(URI.parse(String(payload))) };
			case 'copyText':
				return { handled: true, value: this.clipboardService.writeText(String(data?.text ?? '')) };
			case 'insertAtCursor': {
				const editor = this.codeEditorService.getFocusedCodeEditor();
				if (!editor) {
					return { handled: true, value: undefined };
				}
				const selection = editor.getSelection();
				return { handled: true, value: selection && editor.executeEdits('agent.insertAtCursor', [{ range: selection, text: String(data?.text ?? '') }]) };
			}
			case 'workbench/getAppearanceLayout':
				return { handled: true, value: {
					statusBarVisible: this.configurationService.getValue<boolean>('workbench.statusBar.visible'),
					activityBarOrientation: this.configurationService.getValue<string>('workbench.activityBar.orientation') === 'horizontal' ? 'horizontal' : 'vertical',
				} };
			case 'workbench/setAppearanceLayout':
				return { handled: true, value: this.setAppearanceLayout(data) };
			default:
				return { handled: false };
		}
	}

	private async setAppearanceLayout(data: Record<string, unknown> | undefined): Promise<void> {
		if (typeof data?.statusBarVisible === 'boolean') {
			await this.configurationService.updateValue('workbench.statusBar.visible', data.statusBarVisible);
		}
		if (data?.activityBarOrientation === 'horizontal' || data?.activityBarOrientation === 'vertical') {
			await this.configurationService.updateValue('workbench.activityBar.orientation', data.activityBarOrientation);
		}
	}

	private async handleRequest(requestKind: 'ide' | 'core', messageType: string, payload: unknown): Promise<unknown> {
		const data = payload as Record<string, any> | undefined;
		switch (messageType) {
			case 'getIdeInfo':
				return {
					ideType: 'vscode',
					name: this.productService.nameLong,
					version: this.productService.version,
					remoteName: this.environmentService.remoteAuthority ? 'remote' : 'local',
					extensionVersion: this.productService.version,
					isPrerelease: !!this.productService.quality && this.productService.quality !== 'stable',
				};
			case 'getWorkspaceDirs':
				return this.workspaceContextService.getWorkspace().folders.map(folder => folder.uri.toString());
			case 'isWorkspaceRemote':
				return !!this.environmentService.remoteAuthority;
			case 'getGitRootPath': {
				const repository = this.scmService.getRepository(this.toResource(data?.dir));
				return repository?.provider.rootUri?.toString();
			}
			case 'getBranch': {
				const repository = this.scmService.getRepository(this.toResource(data?.dir));
				return repository?.provider.historyProvider?.get()?.historyItemRef.get()?.name ?? 'NONE';
			}
			case 'getGitRefs': {
				const repository = this.scmService.getRepository(this.toResource(data?.dir));
				const history = repository?.provider.historyProvider.get();
				const refs = await history?.provideHistoryItemRefs() ?? [];
				// SCM ref objects can carry ThemeIcon/URI instances. Keep the
				// worker boundary to the plain data shape declared by the Agent
				// protocol so @branch/@commit never depend on structured-clone
				// support for workbench-specific classes.
				return refs.map(ref => ({ id: ref.id, name: ref.name, revision: ref.revision }));
			}
			case 'getGitHistory': {
				const repository = this.scmService.getRepository(this.toResource(data?.dir));
				const history = repository?.provider.historyProvider.get();
				const items = await history?.provideHistoryItems({ historyItemRefs: [String(data?.ref ?? 'HEAD')], limit: Math.max(1, Math.min(100, Number(data?.limit) || 20)) });
				return (items ?? []).map(item => ({ id: item.id, displayId: item.displayId, subject: item.subject, message: item.message, author: item.author, timestamp: item.timestamp }));
			}
			case 'getGitCommitContext': {
				const repository = this.scmService.getRepository(this.toResource(data?.dir));
				return repository?.provider.historyProvider.get()?.resolveHistoryItemChatContext(String(data?.commitId ?? ''));
			}
			case 'getRepoName': {
				const repository = this.scmService.getRepository(this.toResource(data?.dir));
				const root = repository?.provider.rootUri;
				if (!root) {
					return undefined;
				}
				try {
					const config = (await this.fileService.readFile(URI.joinPath(root, '.git', 'config'))).value.toString();
					const remote = /^\s*url\s*=\s*(.+?)\s*$/m.exec(config)?.[1];
					const path = remote?.replace(/\.git$/i, '').replace(/^[^:]+:/, '').replace(/^.*?:\/\//, '').split('/').slice(-2).join('/');
					return path || undefined;
				} catch {
					return undefined;
				}
			}
			case 'getDiff':
				return this.getWorkspaceDiff(data?.includeUnstaged !== false);
			case 'getIdeSettings':
				return {};
			case 'getBrowserPages':
				return this.commandService.executeCommand(AGENT_BROWSER_GET_OPEN_PAGES_COMMAND);
			case 'getBrowserPageContext':
				return this.commandService.executeCommand(AGENT_BROWSER_GET_PAGE_CONTEXT_COMMAND, data?.browserId);
			case 'ensureBrowserPageShared':
				return this.commandService.executeCommand(AGENT_BROWSER_ENSURE_SHARED_COMMAND, data?.browserId);
			case 'invokeBrowserTool':
				return this.commandService.executeCommand(AGENT_BROWSER_INVOKE_TOOL_COMMAND, { toolId: data?.toolId, parameters: data?.parameters ?? {} });
			case 'notifyAgentBrowserSubmit':
				return this.commandService.executeCommand(AGENT_BROWSER_NOTIFY_SUBMIT_COMMAND);
			case 'gotoDefinition':
				return this.executeLocationProvider('_executeDefinitionProvider', data?.location);
			case 'gotoTypeDefinition':
				return this.executeLocationProvider('_executeTypeDefinitionProvider', data?.location);
			case 'getReferences':
				return this.executeLocationProvider('_executeReferenceProvider', data?.location);
			case 'getSignatureHelp': {
				const location = data?.location;
				return location ? this.commandService.executeCommand('_executeSignatureHelpProvider', this.toResource(location.filepath), { lineNumber: location.position.line + 1, column: location.position.character + 1 }) : null;
			}
			case 'getDocumentSymbols': {
				const symbols = await this.commandService.executeCommand<unknown[]>('_executeDocumentSymbolProvider', this.toResource(data?.textDocumentIdentifier));
				return (symbols ?? []).flatMap(symbol => this.flattenDocumentSymbols(symbol));
			}
			case 'readFileAsDataUrl': {
				const resource = this.toResource(data?.filepath);
				const file = await this.fileService.readFile(resource);
				if (file.value.byteLength === 0 || file.value.byteLength > (typeof data?.maxBytes === 'number' ? data.maxBytes : 5 * 1024 * 1024)) {
					return undefined;
				}
				const extension = resource.path.split('.').pop()?.toLowerCase();
				const mime = ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' } as Record<string, string>)[extension ?? ''] ?? 'application/octet-stream';
				return `data:${mime};base64,${encodeBase64(file.value)}`;
			}
			case 'showVirtualFile': {
				const name = String(data?.name ?? 'Agent Preview');
				const input: IUntitledTextResourceEditorInput = {
					resource: URI.from({ scheme: 'untitled', path: `/${name}` }),
					contents: String(data?.contents ?? data?.content ?? ''),
				};
				const editor = await this.editorService.openEditor(input);
				if (data?.preview === true && name.toLowerCase().endsWith('.md')) {
					await this.commandService.executeCommand('markdown.showPreview', input.resource);
				}
				return editor;
			}
			case 'runCommand': {
				const options = data?.options ?? {};
				const requestedName = typeof options.terminalName === 'string' ? options.terminalName : undefined;
			let terminal = options.reuseTerminal === false ? undefined : this.terminalService.instances.find(instance => requestedName ? instance.title === requestedName : instance === this.terminalService.instances.at(-1));
			if (!terminal) {
				terminal = await this.terminalService.createTerminal({ cwd: typeof options.cwd === 'string' ? options.cwd : undefined, config: requestedName ? { name: requestedName } : undefined });
			}
			await this.terminalService.revealTerminal(terminal);
			await terminal.sendText(String(data?.command ?? ''), false);
			return undefined;
		}
			case 'closeSidebar':
				return this.commandService.executeCommand('workbench.action.closeSidebar');
			case 'reportError': {
				const error = payload as { message?: unknown } | undefined;
				this.notificationService.error(String(error?.message ?? payload ?? 'Agent reported an error'));
				return undefined;
			}
			case 'getTerminalContents': {
				const terminal = this.terminalService.instances.at(-1) as (typeof this.terminalService.instances[number] & { xterm?: { raw?: { buffer?: { active?: { length: number; getLine(index: number): { translateToString(trimRight?: boolean): string } | undefined } } } } }) | undefined;
				const buffer = terminal?.xterm?.raw?.buffer?.active;
				if (!buffer) {
					return '';
				}
				const start = Math.max(0, buffer.length - 200);
				return Array.from({ length: buffer.length - start }, (_, offset) => buffer.getLine(start + offset)?.translateToString(true) ?? '').join('\n');
			}
			case 'getAvailableThreads': {
				const session = this.debugService.getModel().getSessions()[0];
				return session?.getAllThreads().map(thread => ({ id: thread.threadId, name: thread.name })) ?? [];
			}
			case 'getDebugLocals': {
				const session = this.debugService.getModel().getSessions()[0];
				if (!session) {
					return 'No active debug session. Start debugging and pause on a breakpoint to use debugger context.';
				}
				const thread = session.getThread(Number(data?.threadIndex)) ?? session.getAllThreads()[Number(data?.threadIndex)];
				if (!thread) {
					return 'No stack frames available for the selected debug thread.';
				}
				const stack = await session.customRequest('stackTrace', { threadId: thread.threadId, startFrame: 0, levels: 1 }) as { body?: { stackFrames?: Array<{ id: number }> } } | undefined;
				const frame = stack?.body?.stackFrames?.[0];
				if (!frame) {
					return 'No stack frames available for the selected debug thread.';
				}
				const scopes = await session.customRequest('scopes', { frameId: frame.id }) as { body?: { scopes?: Array<{ name?: string; presentationHint?: string; variablesReference: number }> } } | undefined;
				const locals = scopes?.body?.scopes?.find(scope => scope.presentationHint === 'locals' || scope.name?.toLowerCase() === 'locals') ?? scopes?.body?.scopes?.[0];
				if (!locals) {
					return 'No variable scopes available for the selected debug thread.';
				}
				const result = await session.customRequest('variables', { variablesReference: locals.variablesReference }) as { body?: { variables?: Array<{ name: string; type?: string; value: string }> } } | undefined;
				return result?.body?.variables?.map(variable => `name: ${variable.name}, type: ${variable.type ?? 'unknown'}, value: ${variable.value}`).join('\n') || 'No local variables in the current frame.';
			}
			case 'getTopLevelCallStackSources': {
				const session = this.debugService.getModel().getSessions()[0];
				if (!session) {
					return [];
				}
				const thread = session.getThread(Number(data?.threadIndex)) ?? session.getAllThreads()[Number(data?.threadIndex)];
				if (!thread) {
					return [];
				}
				const stack = await session.customRequest('stackTrace', { threadId: thread.threadId, startFrame: 0, levels: Number(data?.stackDepth ?? 3) }) as { body?: { stackFrames?: Array<{ source?: { path?: string; sourceReference?: number } }> } } | undefined;
				const frames = stack?.body?.stackFrames ?? [];
				return Promise.all(frames.map(async frame => {
					if (frame.source?.sourceReference) {
						const source = await session.customRequest('source', { source: frame.source, sourceReference: frame.source.sourceReference }) as { body?: { content?: string } } | undefined;
						return source?.body?.content ?? '';
					}
					if (frame.source?.path) {
						try { return (await this.fileService.readFile(this.toResource(frame.source.path))).value.toString(); } catch { return ''; }
					}
					return '';
				}));
			}
			case 'isTelemetryEnabled':
				return false;
			case 'getUniqueId':
				return this.workspaceContextService.getWorkspace().id;
			case 'readSecrets': {
				const result: Record<string, string> = {};
				for (const key of (data?.keys ?? []) as string[]) {
					const value = await this.secretStorageService.get(key);
					if (value !== undefined) {
						result[key] = value;
					}
				}
				return result;
			}
			case 'writeSecrets':
				for (const [key, value] of Object.entries(data?.secrets ?? {})) {
					await this.secretStorageService.set(key, String(value));
				}
				return undefined;
			case 'fileExists':
				try {
					await this.fileService.stat(this.toResource(data?.filepath ?? data?.path));
					return true;
				} catch {
					return false;
				}
			case 'readFile':
				return (await this.fileService.readFile(this.toResource(data?.filepath ?? data?.path))).value.toString();
			case 'writeFile':
				await this.fileService.writeFile(this.toResource(data?.path ?? data?.filepath), VSBuffer.fromString(data?.contents ?? ''));
				return undefined;
			case 'removeFile':
				await this.fileService.del(this.toResource(data?.path ?? data?.filepath), { useTrash: false });
				return undefined;
			case 'readRangeInFile': {
				const file = await this.fileService.readFile(this.toResource(data?.filepath ?? data?.path));
				const lines = file.value.toString().split(/\r?\n/);
				const range = data?.range;
				const startLine = Math.max(0, range?.start?.line ?? ((range?.startLineNumber ?? 1) - 1));
				const endLine = Math.max(startLine, range?.end?.line ?? (range?.endLineNumber ?? lines.length - 1));
				const selected = lines.slice(startLine, endLine + 1);
				if (selected.length > 0 && typeof range?.start?.character === 'number') {
					selected[0] = selected[0].slice(range.start.character);
				}
				if (selected.length > 0 && typeof range?.end?.character === 'number') {
					selected[selected.length - 1] = selected[selected.length - 1].slice(0, range.end.character);
				}
				return selected.join('\n');
			}
			case 'getFileStats': {
				const result: Record<string, { size: number; lastModified: number }> = {};
				for (const value of (data?.files ?? []) as string[]) {
					try {
						const stat = await this.fileService.stat(this.toResource(value));
						result[value] = { size: stat.size, lastModified: stat.mtime };
					} catch { /* Files may change while an Agent request is running. */ }
				}
				return result;
			}
			case 'getFileResults': {
				const roots = this.workspaceContextService.getWorkspace().folders.map(folder => folder.uri);
				const query = this.queryBuilder.file(roots, {
					includePattern: String(data?.pattern ?? '**/*'),
					maxResults: typeof data?.maxResults === 'number' ? data.maxResults : undefined,
				});
				const result = await this.searchService.fileSearch(query);
				return result.results.map(match => {
					const root = roots.find(folder => relativePath(folder, match.resource) !== undefined);
					return root ? relativePath(root, match.resource) ?? match.resource.toString() : match.resource.toString();
				});
			}
			case 'getSearchResults': {
				const roots = this.workspaceContextService.getWorkspace().folders.map(folder => folder.uri);
				const query = this.queryBuilder.text({ pattern: String(data?.query ?? ''), isRegExp: false, isCaseSensitive: false, isWordMatch: false }, roots, {
					maxResults: typeof data?.maxResults === 'number' ? data.maxResults : undefined,
				});
				const result = await this.searchService.textSearch(query);
				return result.results.map(match => {
					const resource = match.resource.toString();
					const lines = match.results?.map(item => 'previewText' in item ? `${item.rangeLocations[0]?.source.startLineNumber ?? 1}: ${item.previewText.trim()}` : `${item.lineNumber}: ${item.text.trim()}`) ?? [];
					return [resource, ...lines].join('\n');
				}).join('\n');
			}
			case 'listDir': {
				const stat = await this.fileService.resolve(this.toResource(data?.dir));
				return (stat.children ?? []).map(child => [child.name, child.isDirectory ? 2 : child.isSymbolicLink ? 64 : 1]);
			}
			case 'openFile':
				await this.editorService.openEditor({ resource: this.toResource(data?.path ?? data?.filepath) });
				return undefined;
			case 'showLines':
				await this.editorService.openEditor({
					resource: this.toResource(data?.filepath),
					options: { selection: { startLineNumber: (data?.startLine ?? 0) + 1, endLineNumber: (data?.endLine ?? 0) + 1 } },
				} as ITextResourceEditorInput);
				return undefined;
			case 'saveFile':
				await this.textFileService.save(this.toResource(data?.filepath));
				return undefined;
			case 'getOpenFiles':
				return this.editorService.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).flatMap(identifier => identifier.editor.resource ? [identifier.editor.resource.toString()] : []);
			case 'getPinnedFiles':
				return this.editorGroupsService.groups.flatMap(group => group.editors.filter(editor => group.isSticky(editor)).flatMap(editor => editor.resource ? [editor.resource.toString()] : []));
			case 'getCurrentFile': {
				const editor = this.editorService.activeEditor;
				const resource = editor?.resource;
				if (!resource) {
					return undefined;
				}
				const model = (this.editorService.activeTextEditorControl as { getModel?: () => { getValue(): string } | null } | undefined)?.getModel?.();
				const contents = model?.getValue() ?? (await this.fileService.readFile(resource)).value.toString();
				return { isUntitled: resource.scheme === 'untitled', path: resource.toString(), contents };
			}
			case 'getClipboardContent':
				return { text: await this.clipboardService.readText(), copiedAt: new Date().toISOString() };
			case 'getProblems': {
				const resource = typeof data?.filepath === 'string' ? this.toResource(data.filepath) : undefined;
				return this.markerService.read({ resource }).map(marker => ({
					filepath: marker.resource.toString(),
					range: { start: { line: marker.startLineNumber - 1, character: marker.startColumn - 1 }, end: { line: marker.endLineNumber - 1, character: marker.endColumn - 1 } },
					message: marker.message,
				}));
			}
			case 'openUrl':
				await this.openerService.open(URI.parse(String(payload)));
				return undefined;
			case 'showToast': {
				const [severity, message] = payload as [string, string];
				if (severity === 'error') {
					this.notificationService.error(message);
				} else if (severity === 'warning') {
					this.notificationService.warn(message);
				} else {
					this.notificationService.info(message);
				}
				return undefined;
			}
			default:
				if (requestKind === 'core') {
					return this.agentService.requestGui(messageType, payload);
				}
				throw new Error(`Agent workbench operation is not native yet: ${messageType}`);
		}
	}

	private toResource(value: unknown): URI {
		if (typeof value !== 'string' || value.length === 0) {
			throw new Error('Agent file operation requires a path.');
		}
		const resource = URI.parse(value);
		return resource.scheme ? resource : URI.file(value);
	}

	private async getWorkspaceDiff(includeUnstaged: boolean): Promise<string[]> {
		const resources: Array<{ root: URI; resource: ISCMResource; groupId: string }> = [];
		for (const repository of this.scmService.repositories) {
			const root = repository.provider.rootUri;
			if (!root) {
				continue;
			}
			for (const group of repository.provider.groups) {
				const staged = /staged/i.test(`${group.id} ${group.label}`);
				if (!includeUnstaged && !staged) {
					continue;
				}
				for (const resource of group.resources) {
					resources.push({ root, resource, groupId: group.id });
				}
			}
		}
		const results: string[] = [];
		let size = 0;
		for (let index = 0; index < Math.min(resources.length, MAX_AGENT_DIFF_FILES); index += AGENT_DIFF_CONCURRENCY) {
			const batch = await Promise.all(resources.slice(index, index + AGENT_DIFF_CONCURRENCY).map(item => this.createResourceDiff(item.root, item.resource, item.groupId)));
			for (const patch of batch) {
				if (!patch) { continue; }
				const patchSize = new TextEncoder().encode(patch).byteLength;
				if (size + patchSize > MAX_AGENT_DIFF_BYTES) { return results; }
				results.push(patch);
				size += patchSize;
			}
		}
		return results;
	}

	private async createResourceDiff(root: URI, resource: ISCMResource, groupId: string): Promise<string | undefined> {
		const modifiedUri = resource.sourceUri;
		const relative = relativePath(root, modifiedUri) ?? modifiedUri.path;
		const deleted = !!resource.decorations.strikeThrough || /delete/i.test(`${resource.contextValue ?? ''} ${groupId}`);
		const added = !resource.multiDiffEditorOriginalUri && !deleted || /untracked|added/i.test(`${resource.contextValue ?? ''} ${groupId}`);
		let original = '';
		let modified = '';
		try {
			if (!added && !deleted) {
				const originalUri = resource.multiDiffEditorOriginalUri ?? await resource.resourceGroup.provider.getOriginalResource(modifiedUri) ?? undefined;
				if (!originalUri) {
					return undefined;
				}
				original = (await this.fileService.readFile(originalUri, { limits: { size: MAX_AGENT_DIFF_FILE_BYTES } })).value.toString();
			}
			if (!deleted) {
				modified = (await this.fileService.readFile(modifiedUri, { limits: { size: MAX_AGENT_DIFF_FILE_BYTES } })).value.toString();
			}
		} catch {
			return undefined;
		}

		const originalLines = original.split(/\r?\n/);
		const modifiedLines = modified.split(/\r?\n/);
		if (original.endsWith('\n')) { originalLines.pop(); }
		if (modified.endsWith('\n')) { modifiedLines.pop(); }
		const changes = linesDiffComputers.getDefault().computeDiff(originalLines, modifiedLines, {
			ignoreTrimWhitespace: false,
			maxComputationTimeMs: 1000,
			computeMoves: false,
		}).changes;
		const lines = [`diff --git a/${relative} b/${relative}`, `--- ${added ? '/dev/null' : `a/${relative}`}`, `+++ ${deleted ? '/dev/null' : `b/${relative}`}`];
		if (added && modifiedLines.length) {
			lines.push(`@@ -0,0 +1,${modifiedLines.length} @@`, ...modifiedLines.map(line => `+${line}`));
		} else if (deleted && originalLines.length) {
			lines.push(`@@ -1,${originalLines.length} +0,0 @@`, ...originalLines.map(line => `-${line}`));
		} else {
			let previousOriginalEnd = 0;
			let previousModifiedEnd = 0;
			for (const change of changes) {
				const originalStart = Math.max(previousOriginalEnd, change.original.startLineNumber - 4);
				const modifiedStart = Math.max(previousModifiedEnd, change.modified.startLineNumber - 4);
				const originalEnd = Math.min(originalLines.length, change.original.endLineNumberExclusive + 2);
				const modifiedEnd = Math.min(modifiedLines.length, change.modified.endLineNumberExclusive + 2);
				const hunk: string[] = [];
				for (let index = originalStart; index < change.original.startLineNumber - 1; index++) { hunk.push(` ${originalLines[index]}`); }
				for (let index = change.original.startLineNumber - 1; index < change.original.endLineNumberExclusive - 1; index++) { hunk.push(`-${originalLines[index]}`); }
				for (let index = change.modified.startLineNumber - 1; index < change.modified.endLineNumberExclusive - 1; index++) { hunk.push(`+${modifiedLines[index]}`); }
				for (let index = change.original.endLineNumberExclusive - 1; index < originalEnd; index++) { hunk.push(` ${originalLines[index]}`); }
				const originalCount = originalEnd - originalStart;
				const modifiedCount = modifiedEnd - modifiedStart;
				lines.push(`@@ -${originalStart + 1},${originalCount} +${modifiedStart + 1},${modifiedCount} @@`, ...hunk);
				previousOriginalEnd = originalEnd;
				previousModifiedEnd = modifiedEnd;
			}
		}
		return lines.length > 3 ? lines.join('\n') : undefined;
	}

	private async executeLocationProvider(command: string, location: any): Promise<Array<{ filepath: string; range: unknown }>> {
		if (!location?.filepath || !location.position) {
			return [];
		}
		const result = await this.commandService.executeCommand<any[]>(command, this.toResource(location.filepath), {
			lineNumber: location.position.line + 1,
			column: location.position.character + 1,
		});
		return (result ?? []).flatMap(item => {
			const resource = item.targetUri ?? item.uri;
			const range = item.targetRange ?? item.range;
			return resource && range ? [{ filepath: resource.toString(), range }] : [];
		});
	}

	private flattenDocumentSymbols(value: any): Array<{ name: string; range: unknown; selectionRange: unknown; kind: number }> {
		if (!value || typeof value !== 'object') {
			return [];
		}
		const current = [{ name: String(value.name ?? ''), range: value.range, selectionRange: value.selectionRange, kind: Number(value.kind ?? 0) }];
		for (const child of value.children ?? []) {
			current.push(...this.flattenDocumentSymbols(child));
		}
		return current;
	}
}

registerSingleton(IAgentWorkbenchHost, AgentWorkbenchHost, InstantiationType.Delayed);
