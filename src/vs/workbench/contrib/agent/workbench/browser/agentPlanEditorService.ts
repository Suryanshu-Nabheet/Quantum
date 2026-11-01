/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { IAgentPlanEditorService } from '../common/agentPlanEditorService.js';
import type { IAgentPlanViewData } from '../common/agentPlanEditorService.js';
import { AgentPlanEditorInput } from './agentPlanEditorInput.js';

export class AgentPlanEditorService implements IAgentPlanEditorService {
	declare readonly _serviceBrand: undefined;
	constructor(
		@IEditorService private readonly editorService: IEditorService,
		@IEditorGroupsService private readonly editorGroupsService: IEditorGroupsService,
	) {}

	async openPlan(data: IAgentPlanViewData): Promise<void> {
		const plan = normalizePlanData(data);
		const input = this.findInput(plan.sessionId) ?? new AgentPlanEditorInput(plan);
		input.update(plan);
		await this.editorService.openEditor(input, { pinned: true });
	}

	updatePlan(data: IAgentPlanViewData): void {
		const plan = normalizePlanData(data);
		this.findInput(plan.sessionId)?.update(plan);
	}

	private findInput(sessionId: string): AgentPlanEditorInput | undefined {
		for (const group of this.editorGroupsService.groups) {
			const input = group.editors.find(editor => editor instanceof AgentPlanEditorInput && editor.data.sessionId === sessionId);
			if (input instanceof AgentPlanEditorInput) { return input; }
		}
		return undefined;
	}
}

function normalizePlanData(data: IAgentPlanViewData): IAgentPlanViewData {
	if (!data || typeof data.sessionId !== 'string' || !data.sessionId || typeof data.title !== 'string' ||
		typeof data.overview !== 'string' || typeof data.approach !== 'string' || !Array.isArray(data.todos) ||
		typeof data.isBuilding !== 'boolean') {
		throw new Error('The Agent plan data is invalid.');
	}
	const todos = data.todos.slice(0, 30).flatMap(task => {
		if (!task || typeof task.id !== 'string' || typeof task.text !== 'string' ||
			!['pending', 'in_progress', 'done'].includes(task.status)) {
			return [];
		}
		return [{ id: task.id, text: task.text, status: task.status }];
	});
	return {
		sessionId: data.sessionId,
		title: data.title,
		overview: data.overview,
		approach: data.approach,
		todos,
		isBuilding: data.isBuilding,
	};
}

registerSingleton(IAgentPlanEditorService, AgentPlanEditorService, InstantiationType.Delayed);
