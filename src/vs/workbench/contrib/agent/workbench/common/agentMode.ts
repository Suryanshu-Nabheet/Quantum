/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ViewContainer, ViewContainerLocation } from '../../../../common/views.js';
import { AGENT_GUI_VIEW_ID, AGENT_VIEW_CONTAINER_ID } from '../../shared/ids.js';

export { AGENT_GUI_VIEW_ID, AGENT_VIEW_CONTAINER_ID };

/** Quantum's first-party Agent always owns the native secondary sidebar. */
export function isAgentNativeMode(): boolean {
	return true;
}

export function isAgentViewContainer(container: ViewContainer): boolean {
	return container.id === AGENT_VIEW_CONTAINER_ID;
}

export function isAgentView(viewId: string): boolean {
	return viewId === AGENT_GUI_VIEW_ID;
}

export function isAuxiliaryBarReservedForAgent(): boolean {
	return true;
}

export function canUseAuxiliaryBarLocation(location: ViewContainerLocation): boolean {
	return location !== ViewContainerLocation.AuxiliaryBar;
}

export const AGENT_LAYOUT_REASON = 'agentLayout';

export function canMoveViewContainerToLocation(
	container: ViewContainer,
	location: ViewContainerLocation,
): boolean {
	if (isAgentViewContainer(container)) {
		return location === ViewContainerLocation.AuxiliaryBar;
	}
	return location !== ViewContainerLocation.AuxiliaryBar;
}

export function canMoveViewContainerToAuxiliaryBar(container: ViewContainer): boolean {
	return canMoveViewContainerToLocation(container, ViewContainerLocation.AuxiliaryBar);
}
