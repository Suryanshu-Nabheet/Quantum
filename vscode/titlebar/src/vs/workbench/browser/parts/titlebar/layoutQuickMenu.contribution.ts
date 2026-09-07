/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, MenuRegistry, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor, IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { IsAuxiliaryWindowContext } from '../../../common/contextkeys.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { ActionViewItem, IBaseActionViewItemOptions } from '../../../../base/browser/ui/actionbar/actionViewItems.js';
import { IAction } from '../../../../base/common/actions.js';
import { AnchorAlignment, AnchorPosition, IAnchor } from '../../../../base/browser/ui/contextview/contextview.js';
import { $, EventHelper, EventType, addDisposableGenericMouseDownListener, addDisposableListener, append, getDomNodePagePosition, getWindow, isAncestor } from '../../../../base/browser/dom.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { LayoutQuickMenuMode, LayoutQuickMenuWidget } from './layoutQuickMenu.js';
import { IWorkbenchContribution, WorkbenchPhase, registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { IActionViewItemService } from '../../../../platform/actions/browser/actionViewItemService.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../base/common/event.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { ILayoutQuickMenuService } from './layoutQuickMenuService.js';

export const LAYOUT_QUICK_MENU_ACTION_ID = 'workbench.action.layoutQuickMenu';

const layoutQuickMenuIcon = registerIcon('layout-quick-menu-icon', Codicon.gear, localize('layoutQuickMenuIcon', 'Icon for the layout quick menu in the title bar.'));

registerAction2(class LayoutQuickMenuAction extends Action2 {

	constructor() {
		super({
			id: LAYOUT_QUICK_MENU_ACTION_ID,
			title: localize2('layoutQuickMenu', "Layout Quick Menu"),
			icon: layoutQuickMenuIcon,
		});
	}

	run(accessor: ServicesAccessor): void {
		// Handled by the custom action view item.
	}
});

MenuRegistry.appendMenuItem(MenuId.LayoutControlMenu, {
	command: {
		id: LAYOUT_QUICK_MENU_ACTION_ID,
		title: localize('layoutQuickMenu', "Layout Quick Menu"),
		icon: layoutQuickMenuIcon,
	},
	when: ContextKeyExpr.and(
		IsAuxiliaryWindowContext.negate(),
		ContextKeyExpr.or(
			ContextKeyExpr.equals('config.workbench.layoutControl.type', 'toggles'),
			ContextKeyExpr.equals('config.workbench.layoutControl.type', 'both'),
			ContextKeyExpr.equals('config.workbench.layoutControl.type', 'menu'),
		),
	),
	group: '3_layout_quick_menu',
	order: 99,
});

class LayoutQuickMenuController extends Disposable {

	private readonly _onDidChangeOpenState = this._register(new Emitter<boolean>());
	readonly onDidChangeOpenState = this._onDidChangeOpenState.event;

	private _closeContextView: (() => void) | undefined;
	private _anchor: HTMLElement | undefined;
	private _anchorFallback: IAnchor | undefined;
	private _widget: LayoutQuickMenuWidget | undefined;
	private _modeChangeQueue: Promise<void> = Promise.resolve();

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IContextViewService private readonly contextViewService: IContextViewService,
		@ILayoutQuickMenuService private readonly layoutQuickMenuService: ILayoutQuickMenuService,
	) {
		super();
	}

	get isOpen(): boolean {
		return !!this._closeContextView;
	}

	toggle(anchor: HTMLElement): void {
		if (this.isOpen) {
			this.hide();
		} else {
			this.show(anchor);
		}
	}

	show(anchor: HTMLElement): void {
		if (this.isOpen) {
			return;
		}

		this._anchor = anchor;
		this._updateAnchorFallback(anchor);

		const sessionDisposables = new DisposableStore();
		const sessionListeners = new DisposableStore();
		sessionDisposables.add(sessionListeners);

		this.layoutQuickMenuService.notifyOpen({
			disposables: sessionListeners,
			dismiss: () => this.hide(),
		});

		const widget = sessionDisposables.add(this.instantiationService.createInstance(LayoutQuickMenuWidget));
		this._widget = widget;
		widget.setOnRequestClose(() => this.hide());
		widget.setModeChangeHandler(mode => this._queueModeChange(mode));

		const dismissIfOutside = (e: UIEvent): void => {
			if (!this.isOpen) {
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

			this.hide();
		};

		const { close } = this.contextViewService.showContextView({
			getAnchor: () => this._resolveAnchor(anchor),
			anchorAlignment: AnchorAlignment.RIGHT,
			anchorPosition: AnchorPosition.BELOW,
			layer: 2550,
			onDOMEvent: dismissIfOutside,
			render: container => {
				widget.render(container);

				const block = append(container, $('.layout-quick-menu-backdrop'));

				const targetWindow = getWindow(container);
				const interactionDisposables = new DisposableStore();

				interactionDisposables.add(addDisposableGenericMouseDownListener(block, e => {
					if (e.button === 2) {
						return;
					}
					e.preventDefault();
					e.stopPropagation();
					this.hide();
				}));

				interactionDisposables.add(addDisposableListener(targetWindow, EventType.MOUSE_DOWN, dismissIfOutside));
				interactionDisposables.add(addDisposableListener(targetWindow, EventType.POINTER_DOWN, dismissIfOutside));
				interactionDisposables.add(addDisposableListener(targetWindow.document, EventType.MOUSE_DOWN, dismissIfOutside, true));
				interactionDisposables.add(addDisposableListener(targetWindow.document, EventType.POINTER_DOWN, dismissIfOutside, true));
				interactionDisposables.add(addDisposableListener(targetWindow, EventType.BLUR, () => this.hide()));
				interactionDisposables.add(addDisposableListener(targetWindow, EventType.KEY_DOWN, (e: KeyboardEvent) => {
					if (e.keyCode === KeyCode.Escape) {
						e.preventDefault();
						e.stopPropagation();
						this.hide();
					}
				}));

				sessionDisposables.add(interactionDisposables);
				return sessionDisposables;
			},
			onHide: () => {
				this._widget = undefined;
				this._setOpen(false);
				this._closeContextView = undefined;
				if (this._anchor?.isConnected) {
					this._anchor.focus();
				}
				this._anchor = undefined;
				this._anchorFallback = undefined;
			},
		});

		this._closeContextView = close;
		this._setOpen(true);
	}

	hide(): void {
		if (!this._closeContextView) {
			return;
		}

		const close = this._closeContextView;
		this._closeContextView = undefined;
		close();
	}

	private _queueModeChange(mode: LayoutQuickMenuMode): void {
		this._modeChangeQueue = this._modeChangeQueue.then(async () => {
			const widget = this._widget;
			if (!widget) {
				return;
			}

			await widget.applyLayoutMode(mode);

			if (mode === LayoutQuickMenuMode.Zen) {
				this.hide();
				return;
			}

			if (this._widget && !this._widget.isDisposed) {
				this._widget.refreshModeSelection();
			}
		}).catch(error => onUnexpectedError(error));
	}

	private _resolveAnchor(anchor: HTMLElement): HTMLElement | IAnchor {
		if (anchor.isConnected) {
			this._updateAnchorFallback(anchor);
			return anchor;
		}

		return this._anchorFallback ?? anchor;
	}

	private _updateAnchorFallback(anchor: HTMLElement): void {
		if (!anchor.isConnected) {
			return;
		}

		const rect = getDomNodePagePosition(anchor);
		this._anchorFallback = {
			x: rect.left,
			y: rect.top,
			width: rect.width,
			height: rect.height,
		};
	}

	private _setOpen(open: boolean): void {
		this._onDidChangeOpenState.fire(open);
	}

	private _isPointerInside(event: Event): boolean {
		const contextViewElement = this.contextViewService.getContextViewElement();
		const anchor = this._anchor;

		const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
		for (const node of path) {
			if (!(node instanceof Node)) {
				continue;
			}
			if (isAncestor(node, contextViewElement)) {
				return true;
			}
			if (anchor?.isConnected && isAncestor(node, anchor)) {
				return true;
			}
		}

		const target = event.target;
		if (!(target instanceof Node)) {
			return false;
		}

		if (isAncestor(target, contextViewElement)) {
			return true;
		}

		return !!(anchor?.isConnected && isAncestor(target, anchor));
	}
}

class LayoutQuickMenuActionViewItem extends ActionViewItem {

	constructor(
		action: IAction,
		options: IBaseActionViewItemOptions | undefined,
		private readonly menuController: LayoutQuickMenuController,
	) {
		super(null, action, { ...options, icon: true, label: false });
	}

	override render(container: HTMLElement): void {
		super.render(container);
		if (this.element) {
			this.element.setAttribute('aria-haspopup', 'true');
			this._syncOpenState();
		}

		this._register(this.menuController.onDidChangeOpenState(() => this._syncOpenState()));
	}

	override onClick(event: Event): void {
		EventHelper.stop(event, true);

		if (!this.element) {
			return;
		}

		const anchor = this.label ?? this.element;
		this.menuController.toggle(anchor);
	}

	protected override updateChecked(): void {
		if (this.element) {
			this.element.classList.toggle('checked', !!this._action.checked);
			this.element.setAttribute('aria-expanded', this._action.checked ? 'true' : 'false');
		}
		if (this.label) {
			this.label.classList.toggle('checked', !!this._action.checked);
		}
	}

	private _syncOpenState(): void {
		this._action.checked = this.menuController.isOpen;
		this.updateChecked();
	}
}

class LayoutQuickMenuContribution implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.layoutQuickMenu';

	constructor(
		@IActionViewItemService actionViewItemService: IActionViewItemService,
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		const menuController = instantiationService.createInstance(LayoutQuickMenuController);

		actionViewItemService.register(
			MenuId.LayoutControlMenu,
			LAYOUT_QUICK_MENU_ACTION_ID,
			(action, options) => instantiationService.createInstance(LayoutQuickMenuActionViewItem, action, options, menuController),
		);
	}
}

registerWorkbenchContribution2(LayoutQuickMenuContribution.ID, LayoutQuickMenuContribution, WorkbenchPhase.AfterRestored);
