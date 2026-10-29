/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../../base/common/codicons.js';
import { Action2, MenuId, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../../../../platform/configuration/common/configurationRegistry.js';
import { localize, localize2 } from '../../../../../nls.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { registerIcon } from '../../../../../platform/theme/common/iconRegistry.js';
import { ViewPaneContainer } from '../../../../browser/parts/views/viewPaneContainer.js';
import { IViewContainersRegistry, IViewsRegistry, ViewContainerLocation, Extensions as ViewExtensions } from '../../../../common/views.js';
import { AgentViewPane } from '../electron-browser/agentViewPane.js';
import { AGENT_GUI_VIEW_ID, AGENT_VIEW_CONTAINER_ID, LEGACY_AGENT_VIEW_CONTAINER_STORAGE_ID } from '../../shared/ids.js';
import { IViewsService } from '../../../../services/views/common/viewsService.js';
import { IAgentNativeService } from '../electron-browser/agentNativeService.js';
import { KeyCode, KeyMod } from '../../../../../base/common/keyCodes.js';
import { KeybindingsRegistry, KeybindingWeight } from '../../../../../platform/keybinding/common/keybindingsRegistry.js';
import { IAgentWorkbenchHost } from '../electron-browser/agentWorkbenchHost.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';

const agentViewIcon = registerIcon('quantum-agent-view-icon', Codicon.commentDiscussion, localize('agentViewIcon', 'View icon of the Agent view.'));
const quantumCategory = localize2('agent.commands.category', 'Quantum');

const agentViewContainer = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry).registerViewContainer({
	id: AGENT_VIEW_CONTAINER_ID,
	title: localize2('agent.viewContainer.label', "Agent"),
	icon: agentViewIcon,
	order: 1,
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [AGENT_VIEW_CONTAINER_ID, { mergeViewWithContainerWhenSingleView: true }]),
	storageId: LEGACY_AGENT_VIEW_CONTAINER_STORAGE_ID,
	hideIfEmpty: true,
}, ViewContainerLocation.AuxiliaryBar, { isDefault: true });

Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).registerViews([{
	id: AGENT_GUI_VIEW_ID,
	name: localize2('agent.view.label', "Agent"),
	containerIcon: agentViewIcon,
	containerTitle: agentViewContainer.title.value,
	singleViewPaneContainerTitle: agentViewContainer.title.value,
	canToggleVisibility: true,
	canMoveView: true,
	ctorDescriptor: new SyncDescriptor(AgentViewPane),
}], agentViewContainer);

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'agent',
	title: localize('agent.configuration.title', 'Quantum Agent'),
	properties: {
		'agent.enableTabAutocomplete': {
			type: 'boolean',
			default: true,
			markdownDescription: localize('agent.enableTabAutocomplete', 'Enable Agent tab autocomplete. Configure models in Settings → Models.'),
		},
		'agent.pauseTabAutocompleteOnBattery': {
			type: 'boolean',
			default: false,
			description: localize('agent.pauseTabAutocompleteOnBattery', 'Pause tab autocomplete when battery is low.'),
		},
		'agent.showInlineTip': {
			type: 'boolean',
			default: false,
			description: localize('agent.showInlineTip', 'Show the Agent keyboard shortcut tip.'),
		},
		'agent.disableQuickFix': {
			type: 'boolean',
			default: false,
			description: localize('agent.disableQuickFix', 'Disable Agent tab autocomplete quick fixes.'),
		},
	},
});

registerAction2(class OpenAgentPanelAction extends Action2 {
	constructor() {
		super({ id: 'agent.openPanel', title: localize2('agent.openPanel', 'Open Agent Panel'), category: quantumCategory, f1: true });
	}
	run(accessor: ServicesAccessor): Promise<unknown> {
		return accessor.get(IViewsService).openView(AGENT_GUI_VIEW_ID, true);
	}
});

registerAction2(class HideAgentPanelAction extends Action2 {
	constructor() {
		super({ id: 'agent.hidePanel', title: localize2('agent.hidePanel', 'Hide Agent Panel'), category: quantumCategory, f1: false });
	}
	run(accessor: ServicesAccessor): void {
		accessor.get(IViewsService).closeView(AGENT_GUI_VIEW_ID);
	}
});

registerAction2(class ToggleAgentPanelAction extends Action2 {
	constructor() {
		super({ id: 'agent.togglePanel', title: localize2('agent.togglePanel', 'Toggle Agent Panel'), category: quantumCategory, f1: true });
	}
	async run(accessor: ServicesAccessor): Promise<unknown> {
		const viewsService = accessor.get(IViewsService);
		if (viewsService.isViewVisible(AGENT_GUI_VIEW_ID)) {
			viewsService.closeView(AGENT_GUI_VIEW_ID);
			return undefined;
		}
		return viewsService.openView(AGENT_GUI_VIEW_ID, true);
	}
});

registerAction2(class ToggleAgentAutocompleteAction extends Action2 {
	constructor() {
		super({ id: 'agent.toggleTabAutocompleteEnabled', title: localize2('agent.toggleTabAutocomplete', 'Toggle Agent Tab Autocomplete'), category: quantumCategory, f1: false });
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const configurationService = accessor.get(IConfigurationService);
		const enabled = configurationService.getValue<boolean>('agent.enableTabAutocomplete') !== false;
		await configurationService.updateValue('agent.enableTabAutocomplete', !enabled);
	}
});

const guiActions: Array<{ id: string; title: string; messageType: string; data?: unknown }> = [
	{ id: 'agent.newSession', title: 'New Agent Session', messageType: 'newSession' },
	{ id: 'agent.focusAgentInput', title: 'Focus Agent Input', messageType: 'focusAgentInput' },
	{ id: 'agent.focusAgentInputWithoutClear', title: 'Focus Agent Input Without Clearing', messageType: 'focusAgentInputWithoutClear' },
	{ id: 'agent.focusEdit', title: 'Edit Selection with Agent', messageType: 'focusEdit' },
	{ id: 'agent.exitEditMode', title: 'Exit Agent Edit Mode', messageType: 'exitEditMode' },
	{ id: 'agent.openModelPicker', title: 'Open Agent Model Picker', messageType: 'openModelPicker' },
	{ id: 'agent.generateRule', title: 'Generate Agent Rule', messageType: 'generateRule' },
	{ id: 'agent.viewHistory', title: 'View Agent History', messageType: 'navigateTo', data: { path: '/history' } },
	{ id: 'agent.applyCodeFromChat', title: 'Apply Code from Agent Chat', messageType: 'applyCodeFromChat' },
];

registerAction2(class OpenAgentSettingsAction extends Action2 {
	constructor() {
		super({ id: 'agent.openConfigPage', title: localize2('agent.openConfigPage', 'Open Agent Settings'), category: quantumCategory, f1: true });
	}
	run(accessor: ServicesAccessor): void {
		accessor.get(IAgentWorkbenchHost).openSettingsPage('/config');
	}
});

for (const guiAction of guiActions) {
	registerAction2(class extends Action2 {
		constructor() {
			super({
				id: guiAction.id,
				title: localize2(guiAction.id, guiAction.title),
				category: quantumCategory,
				f1: guiAction.id !== 'agent.newSession',
				...((guiAction.id === 'agent.newSession' || guiAction.id === 'agent.viewHistory') ? {
					icon: guiAction.id === 'agent.newSession' ? Codicon.add : Codicon.history,
					menu: {
						id: MenuId.ViewTitle,
						group: 'navigation',
						order: guiAction.id === 'agent.newSession' ? 0 : 1,
						when: ContextKeyExpr.equals('view', AGENT_GUI_VIEW_ID),
					},
				} : {}),
			});
		}
		async run(accessor: ServicesAccessor): Promise<void> {
			const viewsService = accessor.get(IViewsService);
			const agentService = accessor.get(IAgentNativeService);
			await viewsService.openView(AGENT_GUI_VIEW_ID, true);
			agentService.sendGuiMessage(guiAction.messageType, guiAction.data);
		}
	});
}

KeybindingsRegistry.registerKeybindingRule({
	id: 'agent.focusAgentInput',
	weight: KeybindingWeight.WorkbenchContrib,
	primary: KeyMod.CtrlCmd | KeyCode.KeyL,
});
KeybindingsRegistry.registerKeybindingRule({
	id: 'agent.newSession',
	weight: KeybindingWeight.WorkbenchContrib + 1,
	primary: KeyMod.CtrlCmd | KeyCode.KeyN,
	when: ContextKeyExpr.equals('view', AGENT_GUI_VIEW_ID),
});
KeybindingsRegistry.registerKeybindingRule({
	id: 'agent.focusAgentInputWithoutClear',
	weight: KeybindingWeight.WorkbenchContrib,
	primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyL,
});
KeybindingsRegistry.registerKeybindingRule({
	id: 'agent.focusEdit',
	weight: KeybindingWeight.WorkbenchContrib,
	primary: KeyMod.CtrlCmd | KeyCode.KeyI,
});
KeybindingsRegistry.registerKeybindingRule({
	id: 'agent.openModelPicker',
	weight: KeybindingWeight.WorkbenchContrib,
	primary: KeyMod.CtrlCmd | KeyCode.Slash,
});
KeybindingsRegistry.registerKeybindingRule({
	id: 'agent.openConfigPage',
	weight: KeybindingWeight.WorkbenchContrib,
	primary: KeyMod.CtrlCmd | KeyCode.Comma,
});
