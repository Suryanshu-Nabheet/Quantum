/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/sidebarpart.css';
import '../activitybar/media/horizontalActivityBar.css';
import './sidebarActions.js';
import { ActivityBarPosition, IWorkbenchLayoutService, LayoutSettings, Parts, Position as SideBarPosition, isHorizontalActivityBarOrientation } from '../../../services/layout/browser/layoutService.js';
import { SidebarFocusContext, ActiveViewletContext } from '../../../common/contextkeys.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { contrastBorder } from '../../../../platform/theme/common/colorRegistry.js';
import { SIDE_BAR_TITLE_FOREGROUND, SIDE_BAR_TITLE_BORDER, SIDE_BAR_BACKGROUND, SIDE_BAR_FOREGROUND, SIDE_BAR_BORDER, SIDE_BAR_DRAG_AND_DROP_BACKGROUND, ACTIVITY_BAR_BADGE_BACKGROUND, ACTIVITY_BAR_BADGE_FOREGROUND, ACTIVITY_BAR_TOP_FOREGROUND, ACTIVITY_BAR_TOP_ACTIVE_BORDER, ACTIVITY_BAR_TOP_ACTIVE_BACKGROUND, ACTIVITY_BAR_TOP_INACTIVE_FOREGROUND, ACTIVITY_BAR_TOP_DRAG_AND_DROP_BORDER } from '../../../common/theme.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { AnchorAlignment } from '../../../../base/browser/ui/contextview/contextview.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { LayoutPriority } from '../../../../base/browser/ui/grid/grid.js';
import { assertReturnsDefined } from '../../../../base/common/types.js';
import { IViewDescriptorService, ViewContainerLocation } from '../../../common/views.js';
import { AbstractPaneCompositePart, CompositeBarPosition } from '../paneCompositePart.js';
import { ActivityBarCompositeBar, ActivitybarPart } from '../activitybar/activitybarPart.js';
import { ActionsOrientation } from '../../../../base/browser/ui/actionbar/actionbar.js';
import { HoverPosition } from '../../../../base/browser/ui/hover/hoverWidget.js';
import { IPaneCompositeBarOptions } from '../paneCompositeBar.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { Action2, IMenuService, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { Separator } from '../../../../base/common/actions.js';
import { ToggleActivityBarVisibilityActionId } from '../../actions/layoutActions.js';
import { localize2 } from '../../../../nls.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { VisibleViewContainersTracker } from '../visibleViewContainersTracker.js';
import { Extensions } from '../../panecomposite.js';
import { FONT, getFontSize, updateSidebarSize } from '../../../../base/common/font.js';

export class SidebarPart extends AbstractPaneCompositePart {

	static readonly activeViewletSettingsKey = 'workbench.sidebar.activeviewletid';
	static readonly fontSizeSettingsKey = 'workbench.sideBar.experimental.fontSize';

	//#region IView

	readonly minimumWidth: number = 170;
	readonly maximumWidth: number = Number.POSITIVE_INFINITY;
	readonly minimumHeight: number = 0;
	readonly maximumHeight: number = Number.POSITIVE_INFINITY;
	override get snap(): boolean { return true; }

	readonly priority: LayoutPriority = LayoutPriority.Low;

	get preferredWidth(): number | undefined {
		const viewlet = this.getActivePaneComposite();

		if (!viewlet) {
			return undefined;
		}

		const width = viewlet.getOptimalWidth();
		if (typeof width !== 'number') {
			return undefined;
		}

		return Math.max(width, 300);
	}

	private readonly activityBarPart = this._register(this.instantiationService.createInstance(ActivitybarPart, this.location, this));
	private readonly visibleViewContainersTracker: VisibleViewContainersTracker;

	//#endregion

	constructor(
		@INotificationService notificationService: INotificationService,
		@IStorageService storageService: IStorageService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IHoverService hoverService: IHoverService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IThemeService themeService: IThemeService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IExtensionService extensionService: IExtensionService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IMenuService menuService: IMenuService,
	) {
		super(
			Parts.SIDEBAR_PART,
			{ hasTitle: true, trailingSeparator: false, borderWidth: () => (this.getColor(SIDE_BAR_BORDER) || this.getColor(contrastBorder)) ? 1 : 0 },
			SidebarPart.activeViewletSettingsKey,
			ActiveViewletContext.bindTo(contextKeyService),
			SidebarFocusContext.bindTo(contextKeyService),
			'sideBar',
			'viewlet',
			SIDE_BAR_TITLE_FOREGROUND,
			SIDE_BAR_TITLE_BORDER,
			ViewContainerLocation.Sidebar,
			Extensions.Viewlets,
			MenuId.SidebarTitle,
			notificationService,
			storageService,
			contextMenuService,
			layoutService,
			keybindingService,
			hoverService,
			instantiationService,
			themeService,
			viewDescriptorService,
			contextKeyService,
			extensionService,
			menuService,
		);

		// Track visible view containers for auto-hide
		this.visibleViewContainersTracker = this._register(instantiationService.createInstance(VisibleViewContainersTracker, ViewContainerLocation.Sidebar));
		this._register(this.visibleViewContainersTracker.onDidChange((e) => this.onDidChangeAutoHideViewContainers(e)));

		this.rememberActivityBarVisiblePosition();
		this._register(configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(LayoutSettings.ACTIVITY_BAR_ORIENTATION) && !isHorizontalActivityBarOrientation(this.configurationService)) {
				this.restoreClassicActivityBarPinState();
			}
			if (e.affectsConfiguration(LayoutSettings.ACTIVITY_BAR_LOCATION)) {
				this.onDidChangeActivityBarLocation();
			}
			if (e.affectsConfiguration(LayoutSettings.ACTIVITY_BAR_ORIENTATION)) {
				this.onDidChangeActivityBarLocation();
			}
			if (e.affectsConfiguration(LayoutSettings.ACTIVITY_BAR_AUTO_HIDE)) {
				this.onDidChangeActivityBarLocation();
			}
			if (e.affectsConfiguration(SidebarPart.fontSizeSettingsKey)) {
				this.applySidebarFontSize();
			}
			if (e.affectsConfiguration('workbench.sideBar.experimental.fontFamily')) {
				this.applySidebarFontFamily();
			}
		}));

		this.registerActions();
		this.migrateHorizontalPinStorageIfNeeded();
	}

	private migrateHorizontalPinStorageIfNeeded(): void {
		if (isHorizontalActivityBarOrientation(this.configurationService)) {
			return;
		}

		this.instantiationService.invokeFunction(accessor => {
			const storageService = accessor.get(IStorageService);
			const migrationKey = 'workbench.activity.horizontalPinStorageMigrated';
			if (storageService.get(migrationKey, StorageScope.PROFILE)) {
				return;
			}

			this.restoreClassicActivityBarPinState();
			storageService.store(migrationKey, 'true', StorageScope.PROFILE, StorageTarget.USER);
		});
	}

	private onDidChangeAutoHideViewContainers(e: { before: number; after: number }): void {
		const autoHide = this.configurationService.getValue<boolean>(LayoutSettings.ACTIVITY_BAR_AUTO_HIDE);
		if (!autoHide) {
			return;
		}

		const visibleBefore = e.before > 1;
		const visibleAfter = e.after > 1;
		if (visibleBefore === visibleAfter) {
			return;
		}

		if (isHorizontalActivityBarOrientation(this.configurationService)) {
			this.onDidChangeActivityBarLocation();
			return;
		}

		const activityBarPosition = this.configurationService.getValue<ActivityBarPosition>(LayoutSettings.ACTIVITY_BAR_LOCATION);
		if (activityBarPosition === ActivityBarPosition.TOP || activityBarPosition === ActivityBarPosition.BOTTOM) {
			this.onDidChangeActivityBarLocation();
		}
	}

	private onDidChangeActivityBarLocation(): void {
		this.activityBarPart.hide();

		this.updateCompositeBar(true);

		const id = this.getActiveComposite()?.getId();
		if (id) {
			this.onTitleAreaUpdate(id);
		}

		// Strip legacy sidebar-level class so horizontal CSS never leaks to other layouts
		const container = this.getContainer();
		container?.classList.remove('horizontal-activitybar');

		if (this.shouldShowActivityBar()) {
			if (!this.layoutService.isVisible(Parts.ACTIVITYBAR_PART)) {
				this.layoutService.setPartHidden(false, Parts.ACTIVITYBAR_PART);
			}
			this.activityBarPart.show();
		}

		this.rememberActivityBarVisiblePosition();
	}

	override updateStyles(): void {
		super.updateStyles();

		const container = assertReturnsDefined(this.getContainer());
		container.classList.remove('horizontal-activitybar');
		container.style.backgroundColor = this.getColor(SIDE_BAR_BACKGROUND) || '';
		container.style.color = this.getColor(SIDE_BAR_FOREGROUND) || '';

		const borderColor = this.getColor(SIDE_BAR_BORDER) || this.getColor(contrastBorder);
		const isPositionLeft = this.layoutService.getSideBarPosition() === SideBarPosition.LEFT;
		container.style.borderRightWidth = borderColor && isPositionLeft ? '1px' : '';
		container.style.borderRightStyle = borderColor && isPositionLeft ? 'solid' : '';
		container.style.borderRightColor = isPositionLeft ? borderColor || '' : '';
		container.style.borderLeftWidth = borderColor && !isPositionLeft ? '1px' : '';
		container.style.borderLeftStyle = borderColor && !isPositionLeft ? 'solid' : '';
		container.style.borderLeftColor = !isPositionLeft ? borderColor || '' : '';
		container.style.outlineColor = this.getColor(SIDE_BAR_DRAG_AND_DROP_BACKGROUND) ?? '';

		this.applySidebarFontSize(container);
		this.applySidebarFontFamily(container);
	}

	override layout(width: number, height: number, top: number, left: number): void {
		if (!this.layoutService.isVisible(Parts.SIDEBAR_PART)) {
			return;
		}

		super.layout(width, height, top, left);
	}

	protected override getTitleAreaDropDownAnchorAlignment(): AnchorAlignment {
		return this.layoutService.getSideBarPosition() === SideBarPosition.LEFT ? AnchorAlignment.LEFT : AnchorAlignment.RIGHT;
	}

	protected override createCompositeBar(): ActivityBarCompositeBar {
		return this.instantiationService.createInstance(ActivityBarCompositeBar, ViewContainerLocation.Sidebar, this.getCompositeBarOptions(), this.partId, this, false);
	}

	protected getCompositeBarOptions(): IPaneCompositeBarOptions {
		if (isHorizontalActivityBarOrientation(this.configurationService)) {
			return this.getHorizontalActivityBarCompositeBarOptions();
		}

		return this.getDefaultCompositeBarOptions();
	}

	private getDefaultCompositeBarOptions(): IPaneCompositeBarOptions {
		return {
			partContainerClass: 'sidebar',
			pinnedViewContainersKey: ActivitybarPart.pinnedViewContainersKey,
			placeholderViewContainersKey: ActivitybarPart.placeholderViewContainersKey,
			viewContainersWorkspaceStateKey: ActivitybarPart.viewContainersWorkspaceStateKey,
			icon: true,
			orientation: ActionsOrientation.HORIZONTAL,
			recomputeSizes: true,
			activityHoverOptions: {
				position: () => this.getCompositeBarPosition() === CompositeBarPosition.BOTTOM ? HoverPosition.ABOVE : HoverPosition.BELOW,
			},
			fillExtraContextMenuActions: actions => {
				if (this.getCompositeBarPosition() === CompositeBarPosition.TITLE) {
					const viewsSubmenuAction = this.getViewsSubmenuAction();
					if (viewsSubmenuAction) {
						actions.push(new Separator());
						actions.push(viewsSubmenuAction);
					}
				}
			},
			compositeSize: 0,
			iconSize: 16,
			overflowActionSize: 30,
			colors: theme => ({
				activeBackgroundColor: theme.getColor(SIDE_BAR_BACKGROUND),
				inactiveBackgroundColor: theme.getColor(SIDE_BAR_BACKGROUND),
				activeBorderBottomColor: theme.getColor(ACTIVITY_BAR_TOP_ACTIVE_BORDER),
				activeForegroundColor: theme.getColor(ACTIVITY_BAR_TOP_FOREGROUND),
				inactiveForegroundColor: theme.getColor(ACTIVITY_BAR_TOP_INACTIVE_FOREGROUND),
				badgeBackground: theme.getColor(ACTIVITY_BAR_BADGE_BACKGROUND),
				badgeForeground: theme.getColor(ACTIVITY_BAR_BADGE_FOREGROUND),
				dragAndDropBorder: theme.getColor(ACTIVITY_BAR_TOP_DRAG_AND_DROP_BORDER)
			}),
			compact: true
		};
	}

	private getHorizontalActivityBarCompositeBarOptions(): IPaneCompositeBarOptions {
		return {
			partContainerClass: 'sidebar',
			pinnedViewContainersKey: ActivitybarPart.horizontalPinnedViewContainersKey,
			placeholderViewContainersKey: ActivitybarPart.horizontalPlaceholderViewContainersKey,
			viewContainersWorkspaceStateKey: ActivitybarPart.horizontalViewContainersWorkspaceStateKey,
			icon: true,
			orientation: ActionsOrientation.HORIZONTAL,
			recomputeSizes: true,
			horizontalActivityBarMode: true,
			activityHoverOptions: {
				position: () => HoverPosition.BELOW,
			},
			fillExtraContextMenuActions: () => { },
			compositeSize: 0,
			iconSize: 16,
			overflowActionSize: 30,
			colors: theme => ({
				activeBackgroundColor: theme.getColor(ACTIVITY_BAR_TOP_ACTIVE_BACKGROUND),
				inactiveBackgroundColor: theme.getColor(SIDE_BAR_BACKGROUND),
				activeBorderBottomColor: theme.getColor(ACTIVITY_BAR_TOP_ACTIVE_BORDER),
				activeForegroundColor: theme.getColor(ACTIVITY_BAR_TOP_FOREGROUND),
				inactiveForegroundColor: theme.getColor(ACTIVITY_BAR_TOP_INACTIVE_FOREGROUND),
				badgeBackground: theme.getColor(ACTIVITY_BAR_BADGE_BACKGROUND),
				badgeForeground: theme.getColor(ACTIVITY_BAR_BADGE_FOREGROUND),
				dragAndDropBorder: theme.getColor(ACTIVITY_BAR_TOP_DRAG_AND_DROP_BORDER)
			}),
			compact: true
		};
	}

	protected shouldShowCompositeBar(): boolean {
		if (isHorizontalActivityBarOrientation(this.configurationService)) {
			return this.shouldShowHorizontalActivityBarCompositeBar();
		}

		return this.shouldShowDefaultCompositeBar();
	}

	private shouldShowHorizontalActivityBarCompositeBar(): boolean {
		const activityBarPosition = this.configurationService.getValue<ActivityBarPosition>(LayoutSettings.ACTIVITY_BAR_LOCATION);
		if (activityBarPosition === ActivityBarPosition.HIDDEN) {
			return false;
		}

		const autoHide = this.configurationService.getValue<boolean>(LayoutSettings.ACTIVITY_BAR_AUTO_HIDE);
		if (autoHide) {
			const visibleCount = this.visibleViewContainersTracker.visibleCount;
			if (visibleCount <= 1) {
				return false;
			}
		}

		return true;
	}

	private shouldShowDefaultCompositeBar(): boolean {
		const activityBarPosition = this.configurationService.getValue<ActivityBarPosition>(LayoutSettings.ACTIVITY_BAR_LOCATION);
		if (activityBarPosition !== ActivityBarPosition.TOP && activityBarPosition !== ActivityBarPosition.BOTTOM) {
			return false;
		}

		const autoHide = this.configurationService.getValue<boolean>(LayoutSettings.ACTIVITY_BAR_AUTO_HIDE);
		if (autoHide) {
			const visibleCount = this.visibleViewContainersTracker.visibleCount;
			if (visibleCount <= 1) {
				return false;
			}
		}

		return true;
	}

	private shouldShowActivityBar(): boolean {
		if (isHorizontalActivityBarOrientation(this.configurationService)) {
			return false;
		}

		if (this.shouldShowCompositeBar()) {
			return false;
		}

		return this.configurationService.getValue(LayoutSettings.ACTIVITY_BAR_LOCATION) !== ActivityBarPosition.HIDDEN;
	}

	protected getCompositeBarPosition(): CompositeBarPosition {
		if (isHorizontalActivityBarOrientation(this.configurationService)) {
			return CompositeBarPosition.HORIZONTAL_ACTIVITY_BAR;
		}

		const activityBarPosition = this.configurationService.getValue<ActivityBarPosition>(LayoutSettings.ACTIVITY_BAR_LOCATION);
		switch (activityBarPosition) {
			case ActivityBarPosition.TOP: return CompositeBarPosition.TOP;
			case ActivityBarPosition.BOTTOM: return CompositeBarPosition.BOTTOM;
			case ActivityBarPosition.HIDDEN:
			case ActivityBarPosition.DEFAULT: // noop
			default: return CompositeBarPosition.TITLE;
		}
	}

	private restoreClassicActivityBarPinState(): void {
		this.instantiationService.invokeFunction(accessor => {
			const storageService = accessor.get(IStorageService);
			const viewDescriptorService = accessor.get(IViewDescriptorService);

			interface IPinnedViewContainerState {
				id: string;
				pinned: boolean;
				order?: number;
				visible?: boolean;
			}

			const pinnedKey = ActivitybarPart.pinnedViewContainersKey;
			let pinned: IPinnedViewContainerState[] = [];
			try {
				pinned = JSON.parse(storageService.get(pinnedKey, StorageScope.PROFILE, '[]'));
			} catch {
				pinned = [];
			}

			let changed = false;

			let horizontalPinned: IPinnedViewContainerState[] = [];
			try {
				horizontalPinned = JSON.parse(
					storageService.get(ActivitybarPart.horizontalPinnedViewContainersKey, StorageScope.PROFILE, '[]')
				);
			} catch {
				horizontalPinned = [];
			}

			// Prefer horizontal pin order when returning to the classic vertical activity bar.
			if (horizontalPinned.length > 0) {
				pinned = horizontalPinned.map(entry => ({ ...entry, pinned: entry.pinned !== false }));
				changed = true;
			} else if (pinned.length === 0) {
				const containers = this.getSidebarViewContainersInDefaultOrder(viewDescriptorService);
				pinned = containers.map(container => ({
					id: container.id,
					pinned: true,
					visible: true,
					order: container.order,
				}));
				changed = true;
			}

			for (const container of viewDescriptorService.getViewContainersByLocation(ViewContainerLocation.Sidebar)) {
				const index = pinned.findIndex(p => p.id === container.id);
				if (index >= 0) {
					if (!pinned[index].pinned) {
						pinned[index] = { ...pinned[index], pinned: true };
						changed = true;
					}
				} else {
					const insertIndex = this.getPinnedViewContainerInsertIndex(pinned, container, viewDescriptorService);
					pinned.splice(insertIndex, 0, { id: container.id, pinned: true, visible: true, order: container.order });
					changed = true;
				}
			}

			if (changed) {
				storageService.store(pinnedKey, JSON.stringify(pinned), StorageScope.PROFILE, StorageTarget.USER);
			}
		});
	}

	private getSidebarViewContainersInDefaultOrder(viewDescriptorService: IViewDescriptorService) {
		return viewDescriptorService.getViewContainersByLocation(ViewContainerLocation.Sidebar)
			.slice()
			.sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
	}

	private getPinnedViewContainerInsertIndex(
		pinned: { id: string; order?: number }[],
		container: { id: string; order?: number },
		viewDescriptorService: IViewDescriptorService,
	): number {
		const newOrder = container.order ?? Number.MAX_SAFE_INTEGER;
		for (let i = 0; i < pinned.length; i++) {
			const existingContainer = viewDescriptorService.getViewContainerById(pinned[i].id);
			const existingOrder = existingContainer?.order ?? pinned[i].order ?? Number.MAX_SAFE_INTEGER;
			if (newOrder < existingOrder) {
				return i;
			}
		}

		return pinned.length;
	}

	private rememberActivityBarVisiblePosition(): void {
		const activityBarPosition = this.configurationService.getValue<string>(LayoutSettings.ACTIVITY_BAR_LOCATION);
		if (activityBarPosition !== ActivityBarPosition.HIDDEN) {
			this.storageService.store(LayoutSettings.ACTIVITY_BAR_LOCATION, activityBarPosition, StorageScope.PROFILE, StorageTarget.USER);
		}
	}

	private getRememberedActivityBarVisiblePosition(): ActivityBarPosition {
		const activityBarPosition = this.storageService.get(LayoutSettings.ACTIVITY_BAR_LOCATION, StorageScope.PROFILE);
		switch (activityBarPosition) {
			case ActivityBarPosition.TOP: return ActivityBarPosition.TOP;
			case ActivityBarPosition.BOTTOM: return ActivityBarPosition.BOTTOM;
			default: return ActivityBarPosition.DEFAULT;
		}
	}

	override getPinnedPaneCompositeIds(): string[] {
		return this.shouldShowCompositeBar() ? super.getPinnedPaneCompositeIds() : this.activityBarPart.getPinnedPaneCompositeIds();
	}

	override getVisiblePaneCompositeIds(): string[] {
		return this.shouldShowCompositeBar() ? super.getVisiblePaneCompositeIds() : this.activityBarPart.getVisiblePaneCompositeIds();
	}

	override getPaneCompositeIds(): string[] {
		return this.shouldShowCompositeBar() ? super.getPaneCompositeIds() : this.activityBarPart.getPaneCompositeIds();
	}

	async focusActivityBar(): Promise<void> {
		if (this.configurationService.getValue(LayoutSettings.ACTIVITY_BAR_LOCATION) === ActivityBarPosition.HIDDEN) {
			await this.configurationService.updateValue(LayoutSettings.ACTIVITY_BAR_LOCATION, this.getRememberedActivityBarVisiblePosition());

			this.onDidChangeActivityBarLocation();
		}

		if (this.shouldShowCompositeBar()) {
			this.focusCompositeBar();
		} else {
			if (!this.layoutService.isVisible(Parts.ACTIVITYBAR_PART)) {
				this.layoutService.setPartHidden(false, Parts.ACTIVITYBAR_PART);
			}

			this.activityBarPart.show(true);
		}
	}

	private applySidebarFontFamily(container?: HTMLElement): void {
		const target = container ?? this.getContainer();
		if (!target) {
			return;
		}

		const family = this.configurationService.getValue<string>('workbench.sideBar.experimental.fontFamily');

		if (family) {
			target.style.setProperty('--vscode-workbench-sidebar-font-family', family);
		} else {
			target.style.removeProperty('--vscode-workbench-sidebar-font-family');
		}

		this._onDidChange.fire(undefined); // Signal grid that size constraints changed
	}

	private applySidebarFontSize(container?: HTMLElement): void {
		const target = container ?? this.getContainer();
		if (!target) {
			return;
		}

		const configuredSize = getFontSize(this.configurationService, SidebarPart.fontSizeSettingsKey, FONT.defaultSidebarSize);

		updateSidebarSize(configuredSize);

		target.style.setProperty('--vscode-workbench-sidebar-font-size', `${FONT.sidebarSize}px`);

		this._onDidChange.fire(undefined); // Signal grid that size constraints changed
	}

	private registerActions(): void {
		const that = this;
		this._register(registerAction2(class extends Action2 {
			constructor() {
				super({
					id: ToggleActivityBarVisibilityActionId,
					title: localize2('toggleActivityBar', "Toggle Activity Bar Visibility"),
				});
			}
			run(): Promise<void> {
				const value = that.configurationService.getValue(LayoutSettings.ACTIVITY_BAR_LOCATION) === ActivityBarPosition.HIDDEN ? that.getRememberedActivityBarVisiblePosition() : ActivityBarPosition.HIDDEN;
				return that.configurationService.updateValue(LayoutSettings.ACTIVITY_BAR_LOCATION, value);
			}
		}));
	}

	toJSON(): object {
		return {
			type: Parts.SIDEBAR_PART
		};
	}
}
