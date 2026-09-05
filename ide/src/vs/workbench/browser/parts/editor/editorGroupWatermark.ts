/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, clearNode, h } from '../../../../base/browser/dom.js';
import { KeybindingLabel } from '../../../../base/browser/ui/keybindingLabel/keybindingLabel.js';
import { coalesce, shuffle } from '../../../../base/common/arrays.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { isMacintosh, isWeb, OS } from '../../../../base/common/platform.js';
import { basename, dirname } from '../../../../base/common/resources.js';
import { localize } from '../../../../nls.js';
import { CommandsRegistry, ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr, ContextKeyExpression, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { IStorageService, StorageScope, StorageTarget, WillSaveStateReason } from '../../../../platform/storage/common/storage.js';
import { defaultKeybindingLabelStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { IWorkspaceContextService, WorkbenchState } from '../../../../platform/workspace/common/workspace.js';
import { IWorkspacesService, IRecentFolder, IRecentWorkspace, isRecentFolder } from '../../../../platform/workspaces/common/workspaces.js';
import { IHostService } from '../../../services/host/browser/host.js';

interface WatermarkEntry {
	readonly id: string;
	readonly text: string;
	readonly when?: {
		native?: ContextKeyExpression;
		web?: ContextKeyExpression;
	};
}

const showChatContextKey = ContextKeyExpr.and(ContextKeyExpr.equals('chatSetupHidden', false), ContextKeyExpr.equals('chatSetupDisabledInWorkspace', false));

const openChat: WatermarkEntry = { text: localize('watermark.openChat', "Open Chat"), id: 'workbench.action.chat.open', when: { native: showChatContextKey, web: showChatContextKey } };
const showCommands: WatermarkEntry = { text: localize('watermark.showCommands', "Show All Commands"), id: 'workbench.action.showCommands' };
const gotoFile: WatermarkEntry = { text: localize('watermark.quickAccess', "Go to File"), id: 'workbench.action.quickOpen' };
const openFile: WatermarkEntry = { text: localize('watermark.openFile', "Open File"), id: 'workbench.action.files.openFile' };
const openFolder: WatermarkEntry = { text: localize('watermark.openFolder', "Open Folder"), id: 'workbench.action.files.openFolder' };
const openFileOrFolder: WatermarkEntry = { text: localize('watermark.openFileFolder', "Open File or Folder"), id: 'workbench.action.files.openFileFolder' };
const openRecent: WatermarkEntry = { text: localize('watermark.openRecent', "Open Recent"), id: 'workbench.action.openRecent' };
const newUntitledFile: WatermarkEntry = { text: localize('watermark.newUntitledFile', "New Untitled Text File"), id: 'workbench.action.files.newUntitledFile' };
const findInFiles: WatermarkEntry = { text: localize('watermark.findInFiles', "Find in Files"), id: 'workbench.action.findInFiles' };
const toggleTerminal: WatermarkEntry = { text: localize({ key: 'watermark.toggleTerminal', comment: ['toggle is a verb here'] }, "Toggle Terminal"), id: 'workbench.action.terminal.toggleTerminal', when: { web: ContextKeyExpr.equals('terminalProcessSupported', true) } };
const startDebugging: WatermarkEntry = { text: localize('watermark.startDebugging', "Start Debugging"), id: 'workbench.action.debug.start', when: { web: ContextKeyExpr.equals('terminalProcessSupported', true) } };
const openSettings: WatermarkEntry = { text: localize('watermark.openSettings', "Open Settings"), id: 'workbench.action.openSettings' };

const baseEntries: WatermarkEntry[] = [
	openChat,
	showCommands,
];

const emptyWindowEntries: WatermarkEntry[] = coalesce([
	...baseEntries,
	openRecent,
	...(isMacintosh && !isWeb ? [openFileOrFolder] : [openFile, openFolder]),
	isMacintosh && !isWeb ? newUntitledFile : undefined, // fill in one more on macOS to get to 5 entries
]);

const workspaceEntries: WatermarkEntry[] = [
	...baseEntries,
	gotoFile,
	findInFiles,
	toggleTerminal,
];

const otherEntries: WatermarkEntry[] = [
	gotoFile,
	findInFiles,
	startDebugging,
	toggleTerminal,
	openSettings,
];

// ------------------------------------------------------------------------
// Action card definitions for the empty-window welcome page
// ------------------------------------------------------------------------

interface ActionCard {
	readonly label: string;
	readonly commandId: string;
	readonly codicon: string; // codicon class name without the `codicon-` prefix
}

const emptyWindowActions: ActionCard[] = [
	{ label: localize('watermark.openProject', "Open project"), commandId: isMacintosh && !isWeb ? 'workbench.action.files.openFileFolder' : 'workbench.action.files.openFolder', codicon: 'folder-opened' },
	{ label: localize('watermark.cloneRepo', "Clone repo"), commandId: 'git.clone', codicon: 'repo-clone' },
	{ label: localize('watermark.connectSSH', "Connect via SSH"), commandId: 'opensshremotes.openEmptyWindow', codicon: 'remote' },
];

const MAX_RECENT_PROJECTS = 5;

export class EditorGroupWatermark extends Disposable {

	private static readonly CACHED_WHEN = 'editorGroupWatermark.whenConditions';
	private static readonly SETTINGS_KEY = 'workbench.tips.enabled';
	private static readonly MINIMUM_ENTRIES = 3;

	private readonly cachedWhen: { [when: string]: boolean };

	private readonly watermarkRoot: HTMLElement;
	private readonly shortcuts: HTMLElement;
	private readonly transientDisposables = this._register(new DisposableStore());
	private readonly keybindingLabels = this._register(new DisposableStore());

	private enabled = false;
	private workbenchState: WorkbenchState;

	constructor(
		container: HTMLElement,
		@IKeybindingService private readonly keybindingService: IKeybindingService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IStorageService private readonly storageService: IStorageService,
		@ICommandService private readonly commandService: ICommandService,
		@IWorkspacesService private readonly workspacesService: IWorkspacesService,
		@ILabelService private readonly labelService: ILabelService,
		@IHostService private readonly hostService: IHostService
	) {
		super();

		this.cachedWhen = this.storageService.getObject(EditorGroupWatermark.CACHED_WHEN, StorageScope.PROFILE, Object.create(null));
		this.workbenchState = this.contextService.getWorkbenchState();

		const elements = h('.editor-group-watermark', [
			h('.watermark-container', [
				h('.letterpress'),
				h('.shortcuts@shortcuts'),
			])
		]);

		append(container, elements.root);
		this.watermarkRoot = elements.root;
		this.shortcuts = elements.shortcuts;

		this.registerListeners();

		this.render();
	}

	private registerListeners(): void {
		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (
				e.affectsConfiguration(EditorGroupWatermark.SETTINGS_KEY) &&
				this.enabled !== this.configurationService.getValue<boolean>(EditorGroupWatermark.SETTINGS_KEY)
			) {
				this.render();
			}
		}));

		this._register(this.contextService.onDidChangeWorkbenchState(workbenchState => {
			if (this.workbenchState !== workbenchState) {
				this.workbenchState = workbenchState;
				this.render();
			}
		}));

		this._register(this.storageService.onWillSaveState(e => {
			if (e.reason === WillSaveStateReason.SHUTDOWN) {
				const entries = [...emptyWindowEntries, ...workspaceEntries, ...otherEntries];
				for (const entry of entries) {
					const when = isWeb ? entry.when?.web : entry.when?.native;
					if (when) {
						this.cachedWhen[entry.id] = this.contextKeyService.contextMatchesRules(when);
					}
				}

				this.storageService.store(EditorGroupWatermark.CACHED_WHEN, JSON.stringify(this.cachedWhen), StorageScope.PROFILE, StorageTarget.MACHINE);
			}
		}));
	}

	private render(): void {
		this.enabled = this.configurationService.getValue<boolean>(EditorGroupWatermark.SETTINGS_KEY);

		clearNode(this.shortcuts);
		this.transientDisposables.clear();

		if (!this.enabled) {
			return;
		}

		if (this.workbenchState === WorkbenchState.EMPTY) {
			this.watermarkRoot.classList.add('welcome-mode');
			this.renderEmptyWindowWelcome();
		} else {
			this.watermarkRoot.classList.remove('welcome-mode');
			this.renderWorkspaceShortcuts();
		}
	}

	// --------------------------------------------------------------------
	// Empty window: Quantum-branded welcome page
	// --------------------------------------------------------------------

	private renderEmptyWindowWelcome(): void {
		const container = this.shortcuts;

		// Action cards row
		const cardsRow = append(container, $('.welcome-cards'));
		for (const card of emptyWindowActions) {
			const cardEl = append(cardsRow, $('button.welcome-card'));
			cardEl.title = card.label;
			cardEl.addEventListener('click', () => {
				this.commandService.executeCommand(card.commandId);
			});

			const iconEl = append(cardEl, $(`span.welcome-card-icon.codicon.codicon-${card.codicon}`));
			iconEl.setAttribute('aria-hidden', 'true');
			const labelEl = append(cardEl, $('span.welcome-card-label'));
			labelEl.textContent = card.label;
		}

		// Recent projects section
		const recentSection = append(container, $('.welcome-recent'));
		const recentHeader = append(recentSection, $('.welcome-recent-header'));
		const recentTitle = append(recentHeader, $('span.welcome-recent-title'));
		recentTitle.textContent = localize('watermark.recentProjects', "Recent projects");

		const viewAll = append(recentHeader, $('a.welcome-recent-viewall'));
		viewAll.textContent = localize('watermark.viewAll', "View all");
		viewAll.tabIndex = 0;
		viewAll.setAttribute('role', 'button');
		viewAll.addEventListener('click', () => {
			this.commandService.executeCommand('workbench.action.openRecent');
		});
		viewAll.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				this.commandService.executeCommand('workbench.action.openRecent');
			}
		});

		const recentList = append(recentSection, $('.welcome-recent-list'));

		// Load recent workspaces asynchronously
		this.loadRecentProjects(recentList, viewAll);

		// Listen for changes to recently opened
		this.transientDisposables.add(this.workspacesService.onDidChangeRecentlyOpened(() => {
			this.loadRecentProjects(recentList, viewAll);
		}));
	}

	private loadRecentProjects(listEl: HTMLElement, viewAllEl: HTMLElement): void {
		this.workspacesService.getRecentlyOpened().then(recent => {
			clearNode(listEl);
			const workspaces = recent.workspaces.slice(0, MAX_RECENT_PROJECTS);
			const total = recent.workspaces.length;

			if (total > 0) {
				viewAllEl.textContent = localize('watermark.viewAllCount', "View all ({0})", total);
			}

			if (workspaces.length === 0) {
				const empty = append(listEl, $('.welcome-recent-empty'));
				empty.textContent = localize('watermark.noRecent', "No recent projects");
				return;
			}

			for (const workspace of workspaces) {
				const uri = isRecentFolder(workspace) ? workspace.folderUri : (workspace as IRecentWorkspace).workspace.configPath;
				const name = workspace.label || basename(uri);
				const parentPath = this.labelService.getUriLabel(dirname(uri), { relative: true });

				const row = append(listEl, $('button.welcome-recent-item'));
				row.title = this.labelService.getUriLabel(uri);
				row.addEventListener('click', () => {
					this.openRecentWorkspace(workspace);
				});

				const nameEl = append(row, $('span.welcome-recent-name'));
				nameEl.textContent = name;

				const pathEl = append(row, $('span.welcome-recent-path'));
				pathEl.textContent = parentPath;
			}
		});
	}

	private openRecentWorkspace(workspace: IRecentFolder | IRecentWorkspace): void {
		if (isRecentFolder(workspace)) {
			this.hostService.openWindow([{ folderUri: workspace.folderUri }], { forceReuseWindow: true });
		} else {
			this.hostService.openWindow([{ workspaceUri: workspace.workspace.configPath }], { forceReuseWindow: true });
		}
	}

	// --------------------------------------------------------------------
	// Workspace: clickable shortcut entries (project open, no file)
	// --------------------------------------------------------------------

	private renderWorkspaceShortcuts(): void {
		const entries = this.filterEntries(workspaceEntries);
		if (entries.length < EditorGroupWatermark.MINIMUM_ENTRIES) {
			const additionalEntries = this.filterEntries(otherEntries);
			shuffle(additionalEntries);
			entries.push(...additionalEntries.slice(0, EditorGroupWatermark.MINIMUM_ENTRIES - entries.length));
		}

		const box = append(this.shortcuts, $('.watermark-box'));

		const update = () => {
			clearNode(box);
			this.keybindingLabels.clear();

			for (const entry of entries) {
				const keys = this.keybindingService.lookupKeybinding(entry.id);
				if (!keys) {
					continue;
				}

				const dl = append(box, $('dl'));
				dl.setAttribute('role', 'button');
				dl.tabIndex = 0;
				dl.title = entry.text;

				const commandId = entry.id;
				dl.addEventListener('click', () => {
					this.commandService.executeCommand(commandId);
				});
				dl.addEventListener('keydown', (e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						this.commandService.executeCommand(commandId);
					}
				});

				const dt = append(dl, $('dt'));
				dt.textContent = entry.text;

				const dd = append(dl, $('dd'));

				const label = this.keybindingLabels.add(new KeybindingLabel(dd, OS, { renderUnboundKeybindings: true, ...defaultKeybindingLabelStyles }));
				label.set(keys);
			}
		};

		update();
		this.transientDisposables.add(this.keybindingService.onDidUpdateKeybindings(update));
	}

	private filterEntries(entries: WatermarkEntry[]): WatermarkEntry[] {
		const filteredEntries = entries
			.filter(entry => {
				if (this.cachedWhen[entry.id]) {
					return true; // cached from previous session
				}

				const contextKey = isWeb ? entry.when?.web : entry.when?.native;
				return !contextKey /* works without context */ || this.contextKeyService.contextMatchesRules(contextKey);
			})
			.filter(entry => !!CommandsRegistry.getCommand(entry.id))
			.filter(entry => !!this.keybindingService.lookupKeybinding(entry.id));

		return filteredEntries;
	}
}
