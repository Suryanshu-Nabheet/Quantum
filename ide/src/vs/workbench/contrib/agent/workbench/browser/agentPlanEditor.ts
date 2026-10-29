/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../../base/browser/dom.js';
import { Dimension } from '../../../../../base/browser/dom.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { localize } from '../../../../../nls.js';
import { FileAccess } from '../../../../../base/common/network.js';
import { MarkdownString } from '../../../../../base/common/htmlContent.js';
import { IMarkdownRendererService } from '../../../../../platform/markdown/browser/markdownRenderer.js';
import { IEditorOptions } from '../../../../../platform/editor/common/editor.js';
import { EditorPane } from '../../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext } from '../../../../common/editor.js';
import { EditorInput } from '../../../../common/editor/editorInput.js';
import { IEditorGroup } from '../../../../services/editor/common/editorGroupsService.js';
import { AgentPlanEditorInput } from './agentPlanEditorInput.js';
import type { IAgentPlanTask, IAgentPlanViewData } from '../common/agentPlanEditorService.js';

const $ = DOM.$;

export class AgentPlanEditor extends EditorPane {
	static readonly ID = AgentPlanEditorInput.EDITOR_ID;
	private readonly editorDisposables = this._register(new DisposableStore());
	private readonly markdownDisposables = this._register(new DisposableStore());
	private root: HTMLElement | undefined;
	private content: HTMLElement | undefined;
	private renderedData: IAgentPlanViewData | undefined;
	private statusElement: HTMLElement | undefined;
	private taskCountElement: HTMLElement | undefined;
	private taskList: HTMLElement | undefined;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IMarkdownRendererService private readonly markdownRendererService: IMarkdownRendererService,
	) {
		super(AgentPlanEditor.ID, group, telemetryService, themeService, storageService);
	}

	protected override createEditor(parent: HTMLElement): void {
		ensureAgentPlanStyles(parent.ownerDocument);
		this.root = DOM.append(parent, $('.agent-plan-editor'));
		this.root.tabIndex = 0;
		this.content = DOM.append(this.root, $('.agent-plan-editor-content'));
	}

	override async setInput(input: EditorInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		if (!(input instanceof AgentPlanEditorInput)) {
			throw new TypeError('AgentPlanEditor requires an AgentPlanEditorInput.');
		}
		await super.setInput(input, options, context, token);
		this.editorDisposables.clear();
		this.editorDisposables.add(input.onDidChangePlan(data => this.render(data)));
		this.render(input.data);
	}

	override clearInput(): void {
		this.editorDisposables.clear();
		if (this.content) { DOM.clearNode(this.content); }
		this.markdownDisposables.clear();
		this.renderedData = undefined;
		this.statusElement = undefined;
		this.taskCountElement = undefined;
		this.taskList = undefined;
		super.clearInput();
	}

	override layout(dimension: Dimension): void {
		if (this.root) {
			this.root.style.height = `${dimension.height}px`;
		}
	}

	override focus(): void {
		super.focus();
		this.root?.focus();
	}

	private render(data: IAgentPlanViewData): void {
		if (!this.content) { return; }
		if (this.renderedData && hasSamePlanContent(this.renderedData, data)) {
			this.updateProgress(data);
			this.renderedData = data;
			return;
		}
		const scrollTop = this.root?.scrollTop ?? 0;
		this.markdownDisposables.clear();
		this.renderedData = data;
		this.statusElement = undefined;
		this.taskCountElement = undefined;
		this.taskList = undefined;
		DOM.clearNode(this.content);
		const main = DOM.append(this.content, $('.agent-plan-editor-main'));
		const heading = DOM.append(main, $('header.agent-plan-editor-heading'));
		const title = DOM.append(heading, $('h1.agent-plan-editor-title'));
		title.textContent = data.title;
		const state = data.isBuilding ? localize('agent.plan.inProgress', 'In progress') : getPlanProgressLabel(data.todos);
		this.statusElement = DOM.append(heading, $('span.agent-plan-editor-status', { 'aria-live': 'polite' }));
		this.statusElement.textContent = state;
		this.statusElement.classList.toggle('is-building', data.isBuilding);

		if (data.overview) {
			const overview = DOM.append(main, $('section.agent-plan-editor-section'));
			DOM.append(overview, $('h2.agent-plan-editor-section-title', undefined, localize('agent.plan.description', 'Description')));
			this.renderMarkdown(overview, data.overview);
		}
		if (data.approach) {
			const approach = DOM.append(main, $('section.agent-plan-editor-section'));
			DOM.append(approach, $('h2.agent-plan-editor-section-title', undefined, localize('agent.plan.approach', 'Approach')));
			this.renderMarkdown(approach, data.approach);
		}
		if (data.todos.length) {
			const section = DOM.append(main, $('section.agent-plan-editor-section.agent-plan-editor-tasks'));
			const titleRow = DOM.append(section, $('div.agent-plan-editor-task-heading'));
			DOM.append(titleRow, $('h2.agent-plan-editor-section-title', undefined, localize('agent.plan.tasks', 'To-dos')));
			this.taskCountElement = DOM.append(titleRow, $('span.agent-plan-editor-task-count'));
			this.taskList = DOM.append(section, $('ol.agent-plan-editor-task-list'));
			for (const task of data.todos) {
				this.renderTask(this.taskList, task);
			}
		}
		this.updateProgress(data);
		if (this.root) { this.root.scrollTop = scrollTop; }
	}

	private updateProgress(data: IAgentPlanViewData): void {
		if (this.statusElement) {
			this.statusElement.textContent = data.isBuilding
				? localize('agent.plan.inProgress', 'In progress')
				: getPlanProgressLabel(data.todos);
			this.statusElement.classList.toggle('is-building', data.isBuilding);
		}
		if (this.taskCountElement) {
			this.taskCountElement.textContent = localize('agent.plan.tasksComplete', '{0}/{1}', data.todos.filter(task => task.status === 'done').length, data.todos.length);
		}
		if (this.taskList) {
			for (const [index, task] of data.todos.entries()) {
				const item = this.taskList.children.item(index) as HTMLElement | null;
				if (!item) { continue; }
				item.classList.toggle('is-pending', task.status === 'pending');
				item.classList.toggle('is-in-progress', task.status === 'in_progress');
				item.classList.toggle('is-done', task.status === 'done');
			}
		}
	}

	private renderMarkdown(parent: HTMLElement, source: string): void {
		const rendered = this.markdownDisposables.add(this.markdownRendererService.render(new MarkdownString(source)));
		rendered.element.classList.add('agent-plan-editor-markdown');
		parent.appendChild(rendered.element);
	}

	private renderTask(list: HTMLElement, task: IAgentPlanTask): void {
		const item = DOM.append(list, $('li.agent-plan-editor-task'));
		item.dataset.taskId = task.id;
		const icon = DOM.append(item, $('span.agent-plan-editor-task-icon', { 'aria-hidden': 'true' }));
		appendTaskStatusIcon(icon, 'pending');
		appendTaskStatusIcon(icon, 'in_progress');
		appendTaskStatusIcon(icon, 'done');
		const text = DOM.append(item, $('div.agent-plan-editor-task-text'));
		this.renderMarkdown(text, task.text);
	}
}

function appendTaskStatusIcon(parent: HTMLElement, status: IAgentPlanTask['status']): void {
	const svg = parent.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.setAttribute('width', '16');
	svg.setAttribute('height', '16');
	svg.setAttribute('class', `agent-plan-editor-task-status-icon is-${status.replace('_', '-')}`);
	const shape = status === 'pending'
		? parent.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'circle')
		: parent.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'path');
	if (status === 'pending') {
		shape.setAttribute('cx', '12');
		shape.setAttribute('cy', '12');
		shape.setAttribute('r', '9');
		shape.setAttribute('stroke-dasharray', '1.8 3.6');
		shape.setAttribute('stroke-width', '1.8');
	} else {
		shape.setAttribute('d', status === 'in_progress'
			? 'm12.75 15 3-3m0 0-3-3m3 3h-7.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'
			: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z');
		shape.setAttribute('stroke-width', '1.6');
	}
	shape.setAttribute('fill', 'none');
	shape.setAttribute('stroke', 'currentColor');
	shape.setAttribute('stroke-linecap', 'round');
	shape.setAttribute('stroke-linejoin', 'round');
	svg.appendChild(shape);
	parent.appendChild(svg);
}

function hasSamePlanContent(previous: IAgentPlanViewData, next: IAgentPlanViewData): boolean {
	return previous.title === next.title && previous.overview === next.overview && previous.approach === next.approach &&
		previous.todos.length === next.todos.length && previous.todos.every((task, index) => {
			const nextTask = next.todos[index];
			return !!nextTask && task.id === nextTask.id && task.text === nextTask.text;
		});
}

function ensureAgentPlanStyles(document: Document): void {
	const styleId = 'quantum-agent-plan-editor-styles';
	if (document.getElementById(styleId)) {
		return;
	}
	const link = document.createElement('link');
	link.id = styleId;
	link.rel = 'stylesheet';
	link.href = FileAccess.asBrowserUri('vs/workbench/contrib/agent/workbench/browser/media/agentPlanEditor.css').toString(true);
	document.head.appendChild(link);
}

function getPlanProgressLabel(todos: readonly IAgentPlanTask[]): string {
	if (!todos.length) { return localize('agent.plan.noTasks', 'No tasks'); }
	const complete = todos.filter(todo => todo.status === 'done').length;
	return complete === todos.length
		? localize('agent.plan.complete', 'Complete')
		: localize('agent.plan.taskProgress', '{0} of {1} tasks', complete, todos.length);
}
