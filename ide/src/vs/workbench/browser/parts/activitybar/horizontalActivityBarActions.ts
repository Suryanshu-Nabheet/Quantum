/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { IAction } from '../../../../base/common/actions.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { CompositeBarAction, CompositeBarActionViewItem, ICompositeBarActionViewItemOptions } from '../compositeBarActions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { $, addDisposableGenericMouseDownListener, addDisposableListener, append, clearNode, EventType, getWindow, hide, isAncestor, show } from '../../../../base/browser/dom.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { ILayoutQuickMenuService } from '../titlebar/layoutQuickMenuService.js';

export interface IHorizontalActivityBarDropdownItem {
	readonly id: string;
	readonly name: string;
	readonly keybindingId?: string;
	readonly icon?: ThemeIcon;
	readonly iconClassNames?: string[];
	readonly pinned: boolean;
}

export class HorizontalActivityBarToggleAction extends CompositeBarAction {

	constructor(
		private readonly toggleMenu: () => void
	) {
		super({
			id: 'horizontalActivityBar.toggle',
			name: localize('horizontalActivityBarToggle', "Views"),
			classNames: ThemeIcon.asClassNameArray(Codicon.chevronDown)
		});
	}

	override async run(): Promise<void> {
		this.toggleMenu();
	}
}

export class HorizontalActivityBarToggleActionViewItem extends CompositeBarActionViewItem {

	private isMenuOpen = false;
	private viewsPanel: HTMLElement | undefined;
	private sessionDisposables: DisposableStore | undefined;

	constructor(
		options: ICompositeBarActionViewItemOptions,
		action: CompositeBarAction,
		private readonly getBarContainer: () => HTMLElement | undefined,
		private readonly getHeaderContainer: () => HTMLElement | undefined,
		private readonly getDropdownItems: () => IHorizontalActivityBarDropdownItem[],
		private readonly getActiveCompositeId: () => string | undefined,
		private readonly getCompositeOpenAction: (compositeId: string) => IAction,
		private readonly getCompositePinnedAction: (compositeId: string) => IAction,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@IConfigurationService configurationService: IConfigurationService,
		@IKeybindingService keybindingService: IKeybindingService,
		@ILayoutQuickMenuService private readonly layoutQuickMenuService: ILayoutQuickMenuService,
	) {
		super(action, options, () => false, themeService, hoverService, configurationService, keybindingService);
	}

	override dispose(): void {
		this.hideMenu();
		super.dispose();
	}

	toggleMenu(): void {
		if (this.isMenuOpen) {
			this.hideMenu();
		} else {
			this.showMenu();
		}
	}

	private showMenu(): void {
		const paneContainer = this.getBarContainer();
		if (!paneContainer) {
			return;
		}

		this.ensureViewsPanel(paneContainer);
		this.updateViewsPanelPosition();
		this.renderViewsList();
		show(this.viewsPanel!);
		paneContainer.classList.add('horizontal-activitybar-views-open');
		this.setMenuOpen(true);

		this.sessionDisposables?.dispose();
		this.sessionDisposables = new DisposableStore();

		const sessionListeners = new DisposableStore();
		this.sessionDisposables.add(sessionListeners);
		this.layoutQuickMenuService.notifyOpen({
			disposables: sessionListeners,
			dismiss: () => this.hideMenu(),
		});

		const backdrop = append(paneContainer, $('.horizontal-activitybar-views-backdrop'));
		this.sessionDisposables.add(toDisposable(() => backdrop.remove()));

		const dismissIfOutside = (e: UIEvent): void => {
			if (!this.isMenuOpen) {
				return;
			}

			if (e.type === EventType.MOUSE_DOWN || e.type === EventType.POINTER_DOWN) {
				const mouseEvent = e as MouseEvent;
				if (mouseEvent.button === 2) {
					return;
				}
			}

			if (this._isPointerInside(e)) {
				return;
			}

			this.hideMenu();
		};

		const targetWindow = getWindow(paneContainer);

		this.sessionDisposables.add(addDisposableGenericMouseDownListener(backdrop, e => {
			if (e.button === 2) {
				return;
			}
			e.preventDefault();
			e.stopPropagation();
			this.hideMenu();
		}));
		this.sessionDisposables.add(addDisposableListener(targetWindow, EventType.MOUSE_DOWN, dismissIfOutside));
		this.sessionDisposables.add(addDisposableListener(targetWindow, EventType.POINTER_DOWN, dismissIfOutside));
		this.sessionDisposables.add(addDisposableListener(targetWindow.document, EventType.MOUSE_DOWN, dismissIfOutside, true));
		this.sessionDisposables.add(addDisposableListener(targetWindow.document, EventType.POINTER_DOWN, dismissIfOutside, true));
		this.sessionDisposables.add(addDisposableListener(targetWindow, EventType.BLUR, () => this.hideMenu()));
		this.sessionDisposables.add(addDisposableListener(targetWindow, EventType.KEY_DOWN, (e: KeyboardEvent) => {
			if (e.keyCode === KeyCode.Escape) {
				e.preventDefault();
				e.stopPropagation();
				this.hideMenu();
			}
		}));
	}

	private updateViewsPanelPosition(): void {
		if (!this.viewsPanel) {
			return;
		}

		const top = this.getHeaderContainer()?.offsetHeight ?? 35;
		this.viewsPanel.style.top = `${top}px`;
	}

	private hideMenu(): void {
		if (this.viewsPanel) {
			hide(this.viewsPanel);
		}
		this.getBarContainer()?.classList.remove('horizontal-activitybar-views-open');
		this.setMenuOpen(false);
		this.sessionDisposables?.dispose();
		this.sessionDisposables = undefined;
	}

	private _isPointerInside(event: Event): boolean {
		const insideElements: (HTMLElement | undefined)[] = [this.viewsPanel, this.container];

		const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
		for (const node of path) {
			if (!(node instanceof Node)) {
				continue;
			}
			for (const element of insideElements) {
				if (element && isAncestor(node, element)) {
					return true;
				}
			}
		}

		const target = event.target;
		if (!(target instanceof Node)) {
			return false;
		}

		for (const element of insideElements) {
			if (element && isAncestor(target, element)) {
				return true;
			}
		}

		return false;
	}

	private ensureViewsPanel(barContainer: HTMLElement): void {
		if (this.viewsPanel) {
			return;
		}

		this.viewsPanel = append(barContainer, $('.horizontal-activitybar-views-panel'));
		this.viewsPanel.setAttribute('role', 'menu');

		this._register(addDisposableListener(this.viewsPanel, EventType.CLICK, e => {
			const target = e.target as HTMLElement;
			const pin = target.closest('.horizontal-activitybar-views-item-pin') as HTMLElement | null;
			if (pin) {
				e.stopPropagation();
				if (pin.classList.contains('disabled')) {
					return;
				}
				const row = pin.closest('.horizontal-activitybar-views-item') as HTMLElement | null;
				const compositeId = row?.dataset['compositeId'];
				if (compositeId) {
					this.getCompositePinnedAction(compositeId).run(compositeId);
					this.renderViewsList();
				}
				return;
			}

			const row = target.closest('.horizontal-activitybar-views-item') as HTMLElement | null;
			const compositeId = row?.dataset['compositeId'];
			if (compositeId) {
				this.getCompositeOpenAction(compositeId).run();
				this.hideMenu();
			}
		}));
	}

	private renderViewsList(): void {
		if (!this.viewsPanel) {
			return;
		}

		clearNode(this.viewsPanel);
		const activeId = this.getActiveCompositeId();
		const pinnedCount = this.getDropdownItems().filter(i => i.pinned).length;

		for (const item of this.getDropdownItems()) {
			const row = append(this.viewsPanel, $('.horizontal-activitybar-views-item'));
			row.dataset['compositeId'] = item.id;
			row.classList.toggle('selected', item.id === activeId);
			row.setAttribute('role', 'menuitem');
			row.tabIndex = 0;

			const main = append(row, $('.horizontal-activitybar-views-item-main'));

			const icon = append(main, $('span.horizontal-activitybar-views-item-icon.action-label'));
			if (item.iconClassNames?.length) {
				icon.classList.add(...item.iconClassNames);
			} else if (item.icon) {
				icon.classList.add(...ThemeIcon.asClassNameArray(item.icon));
			}

			append(main, $('span.horizontal-activitybar-views-item-label')).textContent = item.name;

			const keybinding = item.keybindingId
				? this.keybindingService.lookupKeybinding(item.keybindingId)
				: this.keybindingService.lookupKeybinding(item.id);
			if (keybinding) {
				append(main, $('span.horizontal-activitybar-views-item-keybinding')).textContent = keybinding.getLabel() ?? '';
			}

			const pin = append(row, $('span.horizontal-activitybar-views-item-pin.codicon'));
			pin.classList.add(...ThemeIcon.asClassNameArray(item.pinned ? Codicon.pinned : Codicon.pin));
			pin.classList.toggle('not-pinned', !item.pinned);
			pin.setAttribute('role', 'button');
			pin.tabIndex = 0;
			pin.title = item.pinned
				? localize('horizontalActivityBar.unpin', "Unpin '{0}'", item.name)
				: localize('horizontalActivityBar.pin', "Pin '{0}'", item.name);

			if (item.pinned && pinnedCount <= 1) {
				pin.classList.add('disabled');
			}
		}
	}

	override render(container: HTMLElement): void {
		super.render(container);
		container.classList.add('horizontal-activitybar-toggle-item');
		this.updateChevron();
	}

	protected override updateLabel(): void {
		super.updateLabel();
		this.updateChevron();
	}

	private setMenuOpen(open: boolean): void {
		this.isMenuOpen = open;
		this.container.classList.toggle('menu-open', open);
		this.updateChevron();
	}

	private updateChevron(): void {
		if (!this.label) {
			return;
		}
		this.label.classList.toggle('codicon-chevron-up', this.isMenuOpen);
		this.label.classList.toggle('codicon-chevron-down', !this.isMenuOpen);
	}
}
