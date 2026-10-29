/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../../base/common/codicons.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { localize } from '../../../../../nls.js';
import { URI } from '../../../../../base/common/uri.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { EditorInputCapabilities, IUntypedEditorInput } from '../../../../common/editor.js';
import { EditorInput } from '../../../../common/editor/editorInput.js';
import type { IAgentPlanViewData } from '../common/agentPlanEditorService.js';

export class AgentPlanEditorInput extends EditorInput {
	static readonly ID = 'workbench.input.agentPlan';
	static readonly EDITOR_ID = 'workbench.editor.agentPlan';
	private readonly _onDidChangePlan = this._register(new Emitter<IAgentPlanViewData>());
	readonly onDidChangePlan: Event<IAgentPlanViewData> = this._onDidChangePlan.event;

	constructor(private plan: IAgentPlanViewData = { sessionId: '', title: '', overview: '', approach: '', todos: [], isBuilding: false }) {
		super();
	}

	get data(): IAgentPlanViewData {
		return this.plan;
	}

	update(data: IAgentPlanViewData): void {
		if (arePlanViewsEqual(this.plan, data)) {
			return;
		}
		const titleChanged = this.plan.title !== data.title;
		this.plan = data;
		this._onDidChangePlan.fire(data);
		if (titleChanged) {
			this._onDidChangeLabel.fire();
		}
	}

	override get typeId(): string { return AgentPlanEditorInput.ID; }
	override get editorId(): string { return AgentPlanEditorInput.EDITOR_ID; }
	override get resource(): URI { return URI.from({ scheme: 'quantum-agent-plan', path: `/${encodeURIComponent(this.plan.sessionId)}` }); }
	override get capabilities(): EditorInputCapabilities { return super.capabilities | EditorInputCapabilities.Singleton | EditorInputCapabilities.Readonly; }
	override getName(): string { return localize('agent.planEditorName', 'Plan'); }
	override getDescription(): string | undefined { return this.plan.title; }
	override getIcon(): ThemeIcon { return Codicon.checklist; }
	override matches(other: EditorInput | IUntypedEditorInput): boolean {
		return super.matches(other) || other instanceof AgentPlanEditorInput && other.plan.sessionId === this.plan.sessionId;
	}
	serialize(): IAgentPlanViewData { return this.plan; }
}

function arePlanViewsEqual(left: IAgentPlanViewData, right: IAgentPlanViewData): boolean {
	return left.sessionId === right.sessionId && left.title === right.title && left.overview === right.overview &&
		left.approach === right.approach && left.isBuilding === right.isBuilding &&
		left.todos.length === right.todos.length && left.todos.every((task, index) => {
			const nextTask = right.todos[index];
			return !!nextTask && task.id === nextTask.id && task.text === nextTask.text && task.status === nextTask.status;
		});
}
