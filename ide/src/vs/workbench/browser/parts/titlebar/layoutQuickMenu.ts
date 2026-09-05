/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append, clearNode, EventType } from '../../../../base/browser/dom.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ChatConfiguration } from '../../../contrib/chat/common/constants.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { IWorkbenchLayoutService, Parts, Position, positionToString } from '../../../services/layout/browser/layoutService.js';
import { isWeb } from '../../../../base/common/platform.js';
import { mainWindow } from '../../../../base/browser/window.js';

const CHAT_VIEW_ID = 'workbench.panel.chat.view.copilot';
const AGENT_GUI_VIEW_ID = 'agent.agentGUIView';
const AGENT_OPEN_PANEL_COMMAND = 'agent.openPanel';
const BROWSER_EDITOR_ID = 'workbench.editor.browser';
const AGENT_SESSIONS_SIDEBAR_ORIENTATION = 2; // AgentSessionsViewerOrientation.SideBySide

const LAYOUT_TOGGLE_CONTEXT_KEYS = new Set([
	'mainEditorAreaVisible',
	'agentSessionsViewerOrientation',
]);

const LAYOUT_MODE_CONTEXT_KEYS = new Set([
	'inZenMode',
	'activeEditor',
]);

export const enum LayoutQuickMenuMode {
	Agent = 'agent',
	Editor = 'editor',
	Zen = 'zen',
	Browser = 'browser',
}

interface IToggleItem {
	readonly label: string;
	readonly icon?: ThemeIcon;
	readonly commandId: string;
	readonly isOn: () => boolean;
	readonly when?: () => boolean;
}

interface ISwitchBinding {
	readonly switchEl: HTMLElement;
	readonly label: string;
	readonly isOn: () => boolean;
}

interface IModeOptionBinding {
	readonly mode: LayoutQuickMenuMode;
	readonly element: HTMLElement;
}

export class LayoutQuickMenuWidget extends Disposable {

	private readonly _disposables = this._register(new DisposableStore());
	private readonly _switchBindings: ISwitchBinding[] = [];

	private _secondarySideBarLeftSegment: HTMLButtonElement | undefined;
	private _secondarySideBarRightSegment: HTMLButtonElement | undefined;
	private readonly _modeOptions: IModeOptionBinding[] = [];
	private _onRequestClose: (() => void) | undefined;
	private _modeChangeHandler: ((mode: LayoutQuickMenuMode) => void) | undefined;
	private _menuRoot: HTMLElement | undefined;

	constructor(
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ICommandService private readonly commandService: ICommandService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@IKeybindingService private readonly keybindingService: IKeybindingService,
		@IViewsService private readonly viewsService: IViewsService,
	) {
		super();
	}

	setOnRequestClose(callback: () => void): void {
		this._onRequestClose = callback;
	}

	setModeChangeHandler(handler: (mode: LayoutQuickMenuMode) => void): void {
		this._modeChangeHandler = handler;
	}

	get isDisposed(): boolean {
		return this._store.isDisposed;
	}

	getMenuRoot(): HTMLElement | undefined {
		return this._menuRoot;
	}

	render(parent: HTMLElement): void {
		clearNode(parent);
		this._disposables.clear();
		this._switchBindings.length = 0;
		this._modeOptions.length = 0;
		this._secondarySideBarLeftSegment = undefined;
		this._secondarySideBarRightSegment = undefined;
		this._menuRoot = undefined;

		const container = append(parent, $('.layout-quick-menu'));
		this._menuRoot = container;
		this._renderModeGrid(container);
		append(container, $('.layout-quick-menu__divider'));
		this._renderToggleSection(container);
		append(container, $('.layout-quick-menu__divider'));
		this._renderOptionsSection(container);
		append(container, $('.layout-quick-menu__divider'));
		this._renderFooter(container);
		this._registerRefreshListeners();
	}

	private _registerRefreshListeners(): void {
		this._disposables.add(this.layoutService.onDidChangePartVisibility(() => this._refreshAllSwitches()));
		this._disposables.add(this.viewsService.onDidChangeViewVisibility(() => this._refreshAllSwitches()));
		this._disposables.add(this.contextKeyService.onDidChangeContext(e => {
			if (e.affectsSome(LAYOUT_TOGGLE_CONTEXT_KEYS)) {
				this._refreshAllSwitches();
			}
			if (e.affectsSome(LAYOUT_MODE_CONTEXT_KEYS)) {
				this._refreshModeSelection();
			}
		}));
		this._disposables.add(this.layoutService.onDidChangePartVisibility(() => this._refreshModeSelection()));
		this._disposables.add(this.viewsService.onDidChangeViewVisibility(() => this._refreshModeSelection()));
		this._disposables.add(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('workbench.statusBar.visible') ||
				e.affectsConfiguration('workbench.sideBar.location')) {
				this._refreshAllSwitches();
				this._refreshSecondarySideBarPosition();
				this._refreshModeSelection();
			}
		}));
	}

	private _refreshAllSwitches(): void {
		for (const binding of this._switchBindings) {
			this._setSwitchState(binding.switchEl, binding.isOn(), binding.label);
		}
	}

	refreshModeSelection(): void {
		if (this._store.isDisposed) {
			return;
		}

		const selectedMode = this._detectActiveMode();
		for (const { mode, element } of this._modeOptions) {
			element.classList.toggle('is-selected', mode === selectedMode);
		}
	}

	private _refreshModeSelection(): void {
		this.refreshModeSelection();
	}

	private _refreshSecondarySideBarPosition(): void {
		const sideBarLocation = this.configurationService.getValue<string>('workbench.sideBar.location') ?? 'left';
		this._setSecondarySideBarSegmentState(sideBarLocation);
	}

	private _setSecondarySideBarSegmentState(sideBarLocation: string): void {
		if (!this._secondarySideBarLeftSegment || !this._secondarySideBarRightSegment) {
			return;
		}

		this._secondarySideBarLeftSegment.classList.toggle('is-selected', sideBarLocation === 'right');
		this._secondarySideBarRightSegment.classList.toggle('is-selected', sideBarLocation === 'left');
		this._secondarySideBarLeftSegment.setAttribute('aria-checked', String(sideBarLocation === 'right'));
		this._secondarySideBarRightSegment.setAttribute('aria-checked', String(sideBarLocation === 'left'));
	}

	private _detectActiveMode(): LayoutQuickMenuMode {
		const context = this.contextKeyService.getContext(null);
		if (context.getValue<boolean>('inZenMode')) {
			return LayoutQuickMenuMode.Zen;
		}

		const auxiliaryOnLeft = this._isAuxiliaryBarOnLeft();
		const sidebarVisible = this.layoutService.isVisible(Parts.SIDEBAR_PART);
		const auxiliaryVisible = this.layoutService.isVisible(Parts.AUXILIARYBAR_PART);

		if (context.getValue<string>('activeEditor') === BROWSER_EDITOR_ID &&
			auxiliaryOnLeft &&
			!sidebarVisible &&
			auxiliaryVisible) {
			return LayoutQuickMenuMode.Browser;
		}

		if (auxiliaryOnLeft && auxiliaryVisible && sidebarVisible) {
			const chatDisabled = this.configurationService.getValue<boolean>(ChatConfiguration.AIDisabled) === true;
			if (chatDisabled && this.viewsService.isViewVisible(AGENT_GUI_VIEW_ID)) {
				return LayoutQuickMenuMode.Agent;
			}
			if (!chatDisabled &&
				(this.viewsService.isViewVisible(CHAT_VIEW_ID) || this.viewsService.isViewVisible(AGENT_GUI_VIEW_ID))) {
				return LayoutQuickMenuMode.Agent;
			}
		}

		return LayoutQuickMenuMode.Editor;
	}

	private _renderModeGrid(container: HTMLElement): void {
		const grid = append(container, $('.layout-quick-menu__mode-grid'));
		const selectedMode = this._detectActiveMode();

		const modes: { mode: LayoutQuickMenuMode; label: string; render: (parent: HTMLElement) => void }[] = [
			{ mode: LayoutQuickMenuMode.Agent, label: localize('layoutQuickMenu.agent', "Agent"), render: p => this._renderAgentPreview(p) },
			{ mode: LayoutQuickMenuMode.Editor, label: localize('layoutQuickMenu.editor', "Editor"), render: p => this._renderEditorPreview(p) },
			{ mode: LayoutQuickMenuMode.Zen, label: localize('layoutQuickMenu.zen', "Zen"), render: p => this._renderZenPreview(p) },
		];

		if (!isWeb) {
			modes.push({ mode: LayoutQuickMenuMode.Browser, label: localize('layoutQuickMenu.browser', "Browser"), render: p => this._renderBrowserPreview(p) });
		}

		grid.style.gridTemplateColumns = `repeat(${modes.length}, 1fr)`;

		for (const { mode, label, render } of modes) {
			const option = append(grid, $('.layout-quick-menu__mode-option'));
			this._modeOptions.push({ mode, element: option });
			if (selectedMode === mode) {
				option.classList.add('is-selected');
			}
			render(append(option, $('.layout-quick-menu__mode-icon-container')));
			append(option, $('span.layout-quick-menu__mode-label')).textContent = label;
			this._disposables.add(addDisposableListener(option, EventType.POINTER_DOWN, e => {
				e.stopPropagation();
			}));
			this._disposables.add(addDisposableListener(option, EventType.CLICK, e => {
				e.stopPropagation();
				e.preventDefault();
				for (const { element } of this._modeOptions) {
					element.classList.remove('is-selected');
				}
				option.classList.add('is-selected');
				this._modeChangeHandler?.(mode);
			}));
		}
	}

	private _renderToggleSection(container: HTMLElement): void {
		const section = append(container, $('.layout-quick-menu__section'));
		for (const item of this._getToggleItems()) {
			if (item.when && !item.when()) {
				continue;
			}
			this._renderToggleRow(section, item);
		}
	}

	private _getToggleItems(): IToggleItem[] {
		const chatDisabled = this.configurationService.getValue<boolean>(ChatConfiguration.AIDisabled) === true;
		return [
			{
				label: localize('layoutQuickMenu.agentPanel', "Agent"),
				icon: Codicon.commentDiscussion,
				commandId: 'agent.togglePanel',
				isOn: () => this.viewsService.isViewVisible(AGENT_GUI_VIEW_ID) && this.layoutService.isVisible(Parts.AUXILIARYBAR_PART),
				when: () => chatDisabled,
			},
			{
				label: localize('layoutQuickMenu.agents', "Agents"),
				icon: Codicon.layoutSidebarRight,
				commandId: 'agentSessions.toggleAgentSessionsSidebar',
				isOn: () => this.contextKeyService.getContext(null).getValue<number>('agentSessionsViewerOrientation') === 2,
				when: () => this.contextKeyService.getContext(null).getValue<boolean>('chatIsEnabled') === true,
			},
			{
				label: localize('layoutQuickMenu.chat', "Chat"),
				icon: Codicon.commentDiscussion,
				commandId: 'workbench.action.chat.toggle',
				isOn: () => this.viewsService.isViewVisible(CHAT_VIEW_ID),
				when: () => this.contextKeyService.getContext(null).getValue<boolean>('chatIsEnabled') === true,
			},
			{
				label: localize('layoutQuickMenu.editors', "Editors"),
				icon: Codicon.file,
				commandId: 'workbench.action.toggleEditorVisibility',
				isOn: () => this.layoutService.isVisible(Parts.EDITOR_PART, mainWindow),
			},
			{
				label: localize('layoutQuickMenu.panel', "Panel"),
				icon: Codicon.layoutPanel,
				commandId: 'workbench.action.togglePanel',
				isOn: () => this.layoutService.isVisible(Parts.PANEL_PART),
			},
			{
				label: localize('layoutQuickMenu.sidebar', "Sidebar"),
				icon: Codicon.layoutSidebarLeft,
				commandId: 'workbench.action.toggleSidebarVisibility',
				isOn: () => this.layoutService.isVisible(Parts.SIDEBAR_PART),
			},
		];
	}

	private _renderToggleRow(section: HTMLElement, item: IToggleItem): void {
		const row = append(section, $('.layout-quick-menu__row.layout-quick-menu__row--toggle'));
		const left = append(row, $('.layout-quick-menu__row-left'));
		if (item.icon) {
			const iconEl = append(left, $('span.layout-quick-menu__icon'));
			iconEl.classList.add(...ThemeIcon.asClassNameArray(item.icon));
		}
		append(left, $('span.layout-quick-menu__label')).textContent = item.label;

		const switchEl = this._createSwitch(append(row, $('.layout-quick-menu__row-right')), item.isOn(), item.label);
		const keybinding = this.keybindingService.lookupKeybinding(item.commandId);
		if (keybinding?.getLabel()) {
			row.title = `${item.label} (${keybinding.getLabel()})`;
		}
		this._wireToggle(row, switchEl, item.label, item.isOn, () => this.commandService.executeCommand(item.commandId));
	}

	private _renderOptionsSection(container: HTMLElement): void {
		const section = append(container, $('.layout-quick-menu__section'));
		const chatDisabled = this.configurationService.getValue<boolean>(ChatConfiguration.AIDisabled) === true;
		if (!chatDisabled) {
			this._renderSecondarySideBarRow(section);
			append(section, $('.layout-quick-menu__divider'));
		}
		// Note: no Title Bar toggle here. In this layout the title bar hosts the
		// window controls and this very layout-controls menu, so it is required
		// and cannot be hidden — `toggle.toggleCustomTitleBar` only flips the
		// setting without changing visibility, making the toggle a no-op.
		this._renderPartToggle(section, localize('layoutQuickMenu.statusBar', "Status Bar"), () => this.layoutService.isVisible(Parts.STATUSBAR_PART, mainWindow), () => this.commandService.executeCommand('workbench.action.toggleStatusbarVisibility'));
	}

	private _renderSecondarySideBarRow(section: HTMLElement): void {
		const sideBarLocation = this.configurationService.getValue<string>('workbench.sideBar.location') ?? 'left';
		const row = append(section, $('.layout-quick-menu__row.layout-quick-menu__row--position'));
		append(row, $('span.layout-quick-menu__label')).textContent = localize('layoutQuickMenu.secondarySideBar', "Secondary Side Bar");

		const segmented = append(row, $('.layout-quick-menu__segmented'));
		segmented.setAttribute('role', 'radiogroup');
		segmented.setAttribute('aria-label', localize('layoutQuickMenu.secondarySideBarPosition', "Secondary Side Bar Position"));

		this._secondarySideBarLeftSegment = append(segmented, $('button.layout-quick-menu__segment')) as HTMLButtonElement;
		this._secondarySideBarLeftSegment.type = 'button';
		this._secondarySideBarLeftSegment.setAttribute('role', 'radio');
		this._secondarySideBarLeftSegment.textContent = localize('layoutQuickMenu.left', "Left");

		this._secondarySideBarRightSegment = append(segmented, $('button.layout-quick-menu__segment')) as HTMLButtonElement;
		this._secondarySideBarRightSegment.type = 'button';
		this._secondarySideBarRightSegment.setAttribute('role', 'radio');
		this._secondarySideBarRightSegment.textContent = localize('layoutQuickMenu.right', "Right");

		this._setSecondarySideBarSegmentState(sideBarLocation);

		this._disposables.add(addDisposableListener(this._secondarySideBarLeftSegment, EventType.CLICK, e => {
			e.stopPropagation();
			const currentLocation = this.configurationService.getValue<string>('workbench.sideBar.location') ?? 'left';
			if (currentLocation === 'right') {
				return;
			}
			this._setSecondarySideBarSegmentState('right');
			void this.configurationService.updateValue('workbench.sideBar.location', positionToString(Position.RIGHT))
				.finally(() => this._refreshSecondarySideBarPosition());
		}));
		this._disposables.add(addDisposableListener(this._secondarySideBarRightSegment, EventType.CLICK, e => {
			e.stopPropagation();
			const currentLocation = this.configurationService.getValue<string>('workbench.sideBar.location') ?? 'left';
			if (currentLocation === 'left') {
				return;
			}
			this._setSecondarySideBarSegmentState('left');
			void this.configurationService.updateValue('workbench.sideBar.location', positionToString(Position.LEFT))
				.finally(() => this._refreshSecondarySideBarPosition());
		}));
	}

	private _renderPartToggle(section: HTMLElement, label: string, isOn: () => boolean, run: () => Promise<void> | void): void {
		const row = append(section, $('.layout-quick-menu__row.layout-quick-menu__row--toggle'));
		append(append(row, $('.layout-quick-menu__row-left')), $('span.layout-quick-menu__label')).textContent = label;
		const switchEl = this._createSwitch(append(row, $('.layout-quick-menu__row-right')), isOn(), label);
		this._wireToggle(row, switchEl, label, isOn, run);
	}

	private _wireToggle(row: HTMLElement, switchEl: HTMLElement, label: string, isOn: () => boolean, run: () => Promise<void> | void): void {
		this._switchBindings.push({ switchEl, label, isOn });
		this._disposables.add(addDisposableListener(row, EventType.CLICK, e => {
			e.stopPropagation();
			this._setSwitchState(switchEl, !isOn(), label);
			void Promise.resolve(run()).finally(() => this._setSwitchState(switchEl, isOn(), label));
		}));
	}

	private _renderFooter(container: HTMLElement): void {
		const section = append(container, $('.layout-quick-menu__section.layout-quick-menu__footer'));
		this._renderFooterLink(
			section,
			localize('layoutQuickMenu.quantumSettings', "Quantum Settings"),
			'agent.openConfigPage',
			Codicon.settingsGear,
		);
		this._renderFooterLink(
			section,
			localize('layoutQuickMenu.editorSettings', "Editor Settings"),
			'workbench.action.openSettings',
			Codicon.settings,
		);
	}

	private _renderFooterLink(section: HTMLElement, label: string, commandId: string, icon: ThemeIcon): void {
		const link = append(section, $('button.layout-quick-menu__footer-link'));
		const left = append(link, $('.layout-quick-menu__row-left'));
		const iconEl = append(left, $('span.layout-quick-menu__icon'));
		iconEl.classList.add(...ThemeIcon.asClassNameArray(icon));
		append(left, $('span.layout-quick-menu__label')).textContent = label;

		const keybinding = this.keybindingService.lookupKeybinding(commandId);
		if (keybinding?.getLabel()) {
			append(link, $('span.layout-quick-menu__keybinding')).textContent = keybinding.getLabel() ?? '';
		}

		link.title = label;
		this._disposables.add(addDisposableListener(link, EventType.CLICK, e => {
			e.stopPropagation();
			void this.commandService.executeCommand(commandId);
			this._onRequestClose?.();
		}));
	}

	private _createSwitch(parent: HTMLElement, on: boolean, label: string): HTMLElement {
		const switchEl = append(parent, $('.layout-quick-menu-switch'));
		switchEl.setAttribute('role', 'switch');
		append(switchEl, $('.layout-quick-menu-switch-thumb'));
		this._setSwitchState(switchEl, on, label);
		return switchEl;
	}

	private _setSwitchState(switchEl: HTMLElement, on: boolean, label?: string): void {
		switchEl.classList.toggle('on', on);
		switchEl.setAttribute('aria-checked', String(on));
		if (label) {
			switchEl.title = on
				? localize('layoutQuickMenu.switchOn', "{0} is on", label)
				: localize('layoutQuickMenu.switchOff', "{0} is off", label);
		}
	}

	private _isAuxiliaryBarOnLeft(): boolean {
		return this._getSideBarLocation() === Position.RIGHT;
	}

	private _getSideBarLocation(): Position {
		const location = this.configurationService.getValue<string>('workbench.sideBar.location') ?? 'left';
		return location === 'right' ? Position.RIGHT : Position.LEFT;
	}

	private async _setSideBarLocation(position: Position): Promise<void> {
		const value = positionToString(position);
		if (this.configurationService.getValue<string>('workbench.sideBar.location') !== value) {
			await this.configurationService.updateValue('workbench.sideBar.location', value);
		}
	}

	private async _exitZenMode(): Promise<void> {
		if (this.contextKeyService.getContext(null).getValue<boolean>('inZenMode')) {
			await this.commandService.executeCommand('workbench.action.toggleZenMode');
		}
	}

	private async _setAgentSessionsSidebarVisible(visible: boolean): Promise<void> {
		if (!this.contextKeyService.getContext(null).getValue<boolean>('chatIsEnabled')) {
			return;
		}

		const orientation = this.contextKeyService.getContext(null).getValue<number>('agentSessionsViewerOrientation');
		const isVisible = orientation === AGENT_SESSIONS_SIDEBAR_ORIENTATION;
		if (visible === isVisible) {
			return;
		}

		try {
			await this.commandService.executeCommand(visible
				? 'agentSessions.showAgentSessionsSidebar'
				: 'agentSessions.hideAgentSessionsSidebar');
		} catch (error) {
			onUnexpectedError(error);
		}
	}

	async applyLayoutMode(mode: LayoutQuickMenuMode): Promise<void> {
		if (this._store.isDisposed) {
			return;
		}

		const inZen = this.contextKeyService.getContext(null).getValue<boolean>('inZenMode') === true;

		try {
			switch (mode) {
				case LayoutQuickMenuMode.Zen:
					if (!inZen) {
						await this.commandService.executeCommand('workbench.action.toggleZenMode');
					}
					break;
				case LayoutQuickMenuMode.Browser:
					await this._exitZenMode();
					await this._setSideBarLocation(Position.RIGHT);
					this.layoutService.setPartHidden(true, Parts.SIDEBAR_PART);
					this.layoutService.setPartHidden(false, Parts.AUXILIARYBAR_PART);
					this.layoutService.setPartHidden(false, Parts.EDITOR_PART);
					await this._setAgentSessionsSidebarVisible(false);
					await this.commandService.executeCommand(AGENT_OPEN_PANEL_COMMAND);
					await this.commandService.executeCommand('workbench.action.browser.open');
					break;
				case LayoutQuickMenuMode.Agent: {
					await this._exitZenMode();
					await this._setSideBarLocation(Position.RIGHT);
					this.layoutService.setPartHidden(false, Parts.SIDEBAR_PART);
					this.layoutService.setPartHidden(false, Parts.AUXILIARYBAR_PART);
					this.layoutService.setPartHidden(false, Parts.EDITOR_PART);
					await this._setAgentSessionsSidebarVisible(false);
					const chatDisabled = this.configurationService.getValue<boolean>(ChatConfiguration.AIDisabled) === true;
					if (chatDisabled) {
						await this.commandService.executeCommand(AGENT_OPEN_PANEL_COMMAND);
					} else if (this.contextKeyService.getContext(null).getValue<boolean>('chatIsEnabled') &&
						!this.viewsService.isViewVisible(CHAT_VIEW_ID)) {
						await this.viewsService.openView(CHAT_VIEW_ID, true);
					}
					break;
				}
				case LayoutQuickMenuMode.Editor:
				default:
					await this._exitZenMode();
					await this._setSideBarLocation(Position.LEFT);
					this.layoutService.setPartHidden(false, Parts.SIDEBAR_PART);
					this.layoutService.setPartHidden(false, Parts.AUXILIARYBAR_PART);
					this.layoutService.setPartHidden(false, Parts.EDITOR_PART);
					await this._setAgentSessionsSidebarVisible(false);
					if (!this.layoutService.isVisible(Parts.EDITOR_PART, mainWindow)) {
						this.layoutService.toggleMaximizedPanel();
					}
					break;
			}
		} catch (error) {
			onUnexpectedError(error);
		}
	}

	private _renderAgentPreview(parent: HTMLElement): void {
		const inner = append(append(append(parent, $('.layout-preview-icon__container')), $('.layout-preview-icon__wrapper')), $('.layout-preview-icon__inner.layout-preview-icon__inner--agent'));
		append(inner, $('.layout-preview-icon__bubble'));
		append(inner, $('.layout-preview-icon__bubble'));
		append(inner, $('.layout-preview-icon__pill'));
	}

	private _renderEditorPreview(parent: HTMLElement): void {
		const inner = append(append(append(parent, $('.layout-preview-icon__container')), $('.layout-preview-icon__wrapper')), $('.layout-preview-icon__inner.layout-preview-icon__inner--editor'));
		const sidebar = append(inner, $('.layout-preview-icon__editor-sidebar'));
		append(sidebar, $('.layout-preview-icon__editor-sidebar-line'));
		append(sidebar, $('.layout-preview-icon__editor-sidebar-line'));
		const content = append(inner, $('.layout-preview-icon__editor-content'));
		this._renderCodeRows(append(content, $('.layout-preview-icon__editor-panel')), 2);
		append(append(append(content, $('.layout-preview-icon__editor-chat')), $('.layout-preview-icon__editor-chat-line')), $('.layout-preview-icon__editor-chat-token.layout-preview-icon__editor-chat-token--wide'));
	}

	private _renderZenPreview(parent: HTMLElement): void {
		const inner = append(append(append(parent, $('.layout-preview-icon__container')), $('.layout-preview-icon__wrapper')), $('.layout-preview-icon__inner.layout-preview-icon__inner--zen'));
		this._renderCodeRows(append(inner, $('.layout-preview-icon__zen-panel')), 2);
	}

	private _renderBrowserPreview(parent: HTMLElement): void {
		const inner = append(append(append(parent, $('.layout-preview-icon__container')), $('.layout-preview-icon__wrapper')), $('.layout-preview-icon__inner.layout-preview-icon__inner--browser'));
		append(inner, $('.layout-preview-icon__browser-toolbar'));
		const content = append(inner, $('.layout-preview-icon__browser-content'));
		append(content, $('.layout-preview-icon__browser-content-line'));
		append(content, $('.layout-preview-icon__browser-content-line.layout-preview-icon__browser-content-line--short'));
	}

	private _renderCodeRows(parent: HTMLElement, count = 2): void {
		const rows: { indent?: number; tokens: string[] }[] = [
			{ tokens: ['layout-preview-icon__editor-token--green', 'layout-preview-icon__editor-token--gray', 'layout-preview-icon__editor-token--gold'] },
			{ indent: 1, tokens: ['layout-preview-icon__editor-token--gray-wide'] },
		];

		for (let i = 0; i < Math.min(count, rows.length); i++) {
			const row = rows[i];
			const rowEl = append(parent, $(`.layout-preview-icon__editor-row${row.indent ? `.layout-preview-icon__editor-row--indent-${row.indent}` : ''}`));
			for (const tokenClass of row.tokens) {
				append(rowEl, $(`.layout-preview-icon__editor-token.${tokenClass}`));
			}
		}
	}
}
