/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize2 } from '../../../../../nls.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { Extensions as ViewExtensions, IViewsRegistry } from '../../../../common/views.js';
import { AGENT_GUI_VIEW_ID } from '../../shared/ids.js';
import { agentViewContainer } from '../browser/agentView.contribution.js';
import { AgentViewPane } from './agentViewPane.js';

Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).registerViews([{
	id: AGENT_GUI_VIEW_ID,
	name: localize2('agent.view.label', 'Agent'),
	containerIcon: agentViewContainer.icon,
	containerTitle: agentViewContainer.title.value,
	singleViewPaneContainerTitle: agentViewContainer.title.value,
	canToggleVisibility: true,
	canMoveView: true,
	ctorDescriptor: new SyncDescriptor(AgentViewPane),
}], agentViewContainer);
