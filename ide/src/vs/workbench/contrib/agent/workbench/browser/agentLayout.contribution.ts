/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IContextKey, IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IWorkbenchContribution, WorkbenchPhase, registerWorkbenchContribution2 } from '../../../../common/contributions.js';
import { Parts, Position, positionToString, IWorkbenchLayoutService } from '../../../../services/layout/browser/layoutService.js';
import { IViewDescriptorService, ViewContainer, ViewContainerLocation } from '../../../../common/views.js';
import {
	AGENT_LAYOUT_REASON,
	isAgentViewContainer,
} from '../common/agentMode.js';
import { AgentNativeModeContext } from '../common/agentNativeContext.js';

/**
 * Agent-native layout: the secondary sidebar is reserved for Agent only.
 * All other extension view containers belong on the primary activity bar.
 * Panel commands are registered with the native Agent workbench contribution.
 */
class AgentLayoutContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.agentLayout';

	private readonly _agentNativeModeContext: IContextKey<boolean>;

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IViewDescriptorService private readonly viewDescriptorService: IViewDescriptorService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		@IContextKeyService contextKeyService: IContextKeyService,
	) {
		super();

		this._agentNativeModeContext = AgentNativeModeContext.bindTo(contextKeyService);
		this._agentNativeModeContext.set(true);

		this.enforceAuxiliaryBarOwnership();
		this.enforceAgentContainerLocation();

		this._register(this.viewDescriptorService.onDidChangeViewContainers(({ added }) => {
			for (const { container, location } of added) {
				if (location === ViewContainerLocation.AuxiliaryBar && !isAgentViewContainer(container)) {
					this.moveContainerToPrimarySidebar(container);
				}
			}
			this.enforceAgentContainerLocation();
		}));

		this._register(this.viewDescriptorService.onDidChangeContainerLocation(({ viewContainer, from, to }) => {
			if (to === ViewContainerLocation.AuxiliaryBar && !isAgentViewContainer(viewContainer)) {
				this.moveContainerToPrimarySidebar(viewContainer);
			}
			if (isAgentViewContainer(viewContainer) && to !== ViewContainerLocation.AuxiliaryBar) {
				this.moveContainerToAuxiliaryBar(viewContainer);
			}
		}));

		this._register(this.viewDescriptorService.onDidChangeLocation(({ views, to }) => {
			if (to !== ViewContainerLocation.AuxiliaryBar) {
				return;
			}
			for (const view of views) {
				const container = this.viewDescriptorService.getViewContainerByViewId(view.id);
				if (container && !isAgentViewContainer(container)) {
					this.viewDescriptorService.moveViewToLocation(view, ViewContainerLocation.Sidebar, AGENT_LAYOUT_REASON);
				}
			}
		}));

		this.applyAgentLayout();
	}

	private moveContainerToPrimarySidebar(container: ViewContainer): void {
		if (isAgentViewContainer(container)) {
			return;
		}
		this.viewDescriptorService.moveViewContainerToLocation(
			container,
			ViewContainerLocation.Sidebar,
			undefined,
			AGENT_LAYOUT_REASON,
		);
	}

	private moveContainerToAuxiliaryBar(container: ViewContainer): void {
		if (!isAgentViewContainer(container)) {
			return;
		}
		this.viewDescriptorService.moveViewContainerToLocation(
			container,
			ViewContainerLocation.AuxiliaryBar,
			undefined,
			AGENT_LAYOUT_REASON,
		);
	}

	private enforceAuxiliaryBarOwnership(): void {
		const auxiliaryContainers = this.viewDescriptorService.getViewContainersByLocation(ViewContainerLocation.AuxiliaryBar);
		for (const container of auxiliaryContainers) {
			if (!isAgentViewContainer(container)) {
				this.moveContainerToPrimarySidebar(container);
			}
		}
	}

	private enforceAgentContainerLocation(): void {
		for (const location of [ViewContainerLocation.Sidebar, ViewContainerLocation.Panel]) {
			const containers = this.viewDescriptorService.getViewContainersByLocation(location);
			for (const container of containers) {
				if (isAgentViewContainer(container)) {
					this.moveContainerToAuxiliaryBar(container);
				}
			}
		}
	}

	private applyAgentLayout(): void {
		if (this.configurationService.getValue<string>('workbench.sideBar.location') !== positionToString(Position.LEFT)) {
			void this.configurationService.updateValue('workbench.sideBar.location', positionToString(Position.LEFT));
		}

		this.layoutService.setPartHidden(false, Parts.SIDEBAR_PART);
		this.layoutService.setPartHidden(false, Parts.AUXILIARYBAR_PART);
	}
}

registerWorkbenchContribution2(AgentLayoutContribution.ID, AgentLayoutContribution, WorkbenchPhase.AfterRestored);
