/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../../nls.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../../browser/editor.js';
import { EditorExtensions, IEditorFactoryRegistry, IEditorSerializer } from '../../../../common/editor.js';
import { EditorInput } from '../../../../common/editor/editorInput.js';
import { AgentPlanEditor } from './agentPlanEditor.js';
import { AgentPlanEditorInput } from './agentPlanEditorInput.js';
import type { IAgentPlanViewData } from '../common/agentPlanEditorService.js';
import './agentPlanEditorService.js';

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(AgentPlanEditor, AgentPlanEditor.ID, localize('agentPlanEditor', 'Plan')),
	[new SyncDescriptor(AgentPlanEditorInput)]
);

class AgentPlanEditorSerializer implements IEditorSerializer {
	canSerialize(input: EditorInput): boolean { return input instanceof AgentPlanEditorInput; }
	serialize(input: EditorInput): string | undefined {
		return input instanceof AgentPlanEditorInput ? JSON.stringify(input.serialize()) : undefined;
	}
	deserialize(_instantiationService: IInstantiationService, serialized: string): EditorInput | undefined {
		try {
			const data = JSON.parse(serialized) as Partial<IAgentPlanViewData> | undefined;
			if (!data || typeof data.sessionId !== 'string' || typeof data.title !== 'string' ||
				typeof data.overview !== 'string' || typeof data.approach !== 'string' ||
				typeof data.isBuilding !== 'boolean' || !Array.isArray(data.todos) ||
				!data.todos.every(task => !!task && typeof task.id === 'string' && typeof task.text === 'string' &&
					(task.status === 'pending' || task.status === 'in_progress' || task.status === 'done'))) {
				return undefined;
			}
			return new AgentPlanEditorInput(data as IAgentPlanViewData);
		} catch {
			return undefined;
		}
	}
}

Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerEditorSerializer(AgentPlanEditorInput.ID, AgentPlanEditorSerializer);
