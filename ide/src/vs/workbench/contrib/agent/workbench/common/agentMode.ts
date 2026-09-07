/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { ExtensionIdentifier } from '../../../../../platform/extensions/common/extensions.js';
import { ChatConfiguration } from '../../../chat/common/constants.js';
import { ViewContainer, ViewContainerLocation } from '../../../../common/views.js';
import { AGENT_EXTENSION_ID, AGENT_GUI_VIEW_ID, AGENT_VIEW_CONTAINER_ID } from '../../shared/ids.js';

export { AGENT_EXTENSION_ID, AGENT_GUI_VIEW_ID, AGENT_VIEW_CONTAINER_ID };

/** Quantum AI-native mode: Copilot disabled, Agent owns the secondary sidebar. */
export function isAgentNativeMode(configurationService: IConfigurationService): boolean {
	return configurationService.getValue<boolean>(ChatConfiguration.AIDisabled) === true;
}

export function isAgentViewContainer(container: ViewContainer): boolean {
	if (container.id === AGENT_VIEW_CONTAINER_ID) {
		return true;
	}
	return !!container.extensionId && ExtensionIdentifier.equals(container.extensionId, AGENT_EXTENSION_ID);
}

export function isAgentView(viewId: string): boolean {
	return viewId === AGENT_GUI_VIEW_ID;
}

export function isAuxiliaryBarReservedForAgent(configurationService: IConfigurationService): boolean {
	return isAgentNativeMode(configurationService);
}

export function canUseAuxiliaryBarLocation(location: ViewContainerLocation, configurationService: IConfigurationService): boolean {
	if (location !== ViewContainerLocation.AuxiliaryBar) {
		return true;
	}
	return !isAuxiliaryBarReservedForAgent(configurationService);
}

export const AGENT_LAYOUT_REASON = 'agentLayout';

export function canMoveViewContainerToLocation(
	container: ViewContainer,
	location: ViewContainerLocation,
	configurationService: IConfigurationService,
): boolean {
	if (!isAuxiliaryBarReservedForAgent(configurationService)) {
		return true;
	}
	if (isAgentViewContainer(container)) {
		return location === ViewContainerLocation.AuxiliaryBar;
	}
	return location !== ViewContainerLocation.AuxiliaryBar;
}

export function canMoveViewContainerToAuxiliaryBar(container: ViewContainer, configurationService: IConfigurationService): boolean {
	return canMoveViewContainerToLocation(container, ViewContainerLocation.AuxiliaryBar, configurationService);
}
