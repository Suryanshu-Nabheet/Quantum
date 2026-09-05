/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { append, $, hide, show } from '../../../../../../base/browser/dom.js';
import { disposableTimeout } from '../../../../../../base/common/async.js';
import { IDisposable } from '../../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../../nls.js';
import { OnboardingFeaturePreview } from './onboardingFeaturePreview.js';

interface IGhostLine {
	line: HTMLElement;
	ghost: HTMLElement;
	cursor: HTMLElement;
	showAt: number;
	acceptAt: number;
}

interface IToolCallRow {
	item: HTMLElement;
	row: HTMLElement;
	verb: HTMLElement;
	detail: HTMLElement;
}

interface IPlanTodoRow {
	item: HTMLElement;
	icon: HTMLElement;
	text: HTMLElement;
}

function schedule(
	register: (disposable: IDisposable) => void,
	handler: () => void,
	delayMs: number,
): void {
	register(disposableTimeout(handler, delayMs));
}

function registerGhostSequence(
	register: (disposable: IDisposable) => void,
	steps: IGhostLine[],
): void {
	let activeLine: HTMLElement | undefined;

	for (const step of steps) {
		if (step.showAt > 0) {
			schedule(register, () => {
				if (activeLine) {
					activeLine.classList.remove('highlighted');
				}
				show(step.line);
				step.line.classList.add('highlighted', 'tab-line-enter');
				activeLine = step.line;
				if (step.ghost.textContent) {
					show(step.ghost);
					step.ghost.classList.add('tab-ghost-active');
					show(step.cursor);
				}
			}, step.showAt);
		}

		if (step.acceptAt > 0) {
			schedule(register, () => {
				step.ghost.classList.remove('tab-ghost-active');
				step.ghost.classList.add('accepted');
				hide(step.cursor);
			}, step.acceptAt);
		}
	}
}

function registerToolCallSequence(
	register: (disposable: IDisposable) => void,
	calls: IToolCallRow[],
	sequence: ReadonlyArray<{ show: number; complete?: number }>,
): void {
	for (let i = 0; i < calls.length; i++) {
		const call = calls[i]!;
		const timing = sequence[i]!;

		schedule(register, () => {
			show(call.item);
			call.item.classList.add('agent-toolcall-active', 'agent-toolcall-enter');
			call.verb.classList.add('agent-toolcall-shimmer');
			call.detail.classList.add('agent-toolcall-shimmer');
		}, timing.show);

		if (timing.complete !== undefined) {
			schedule(register, () => {
				call.item.classList.remove('agent-toolcall-active');
				call.item.classList.add('agent-toolcall-complete');
				call.verb.classList.remove('agent-toolcall-shimmer');
				call.detail.classList.remove('agent-toolcall-shimmer');
				const status = call.row.querySelector('.agent-toolcall-status');
				if (status) {
					status.className = 'agent-toolcall-status codicon codicon-check';
				}
			}, timing.complete);
		}
	}
}

export class TabFeaturePreview extends OnboardingFeaturePreview {
	constructor(container: HTMLElement) {
		super('tab-feature-preview');
		this.mountRoot(container);

		const shell = append(this.element, $('.tab-preview-shell'));
		const editor = append(shell, $('.tab-completion-editor'));

		const tabBar = append(editor, $('.tab-editor-tabs'));
		append(tabBar, $('.tab-editor-tab.active', undefined, 'palette.ts'));
		append(tabBar, $('.tab-editor-tab', undefined, 'theme.ts'));

		const preview = append(editor, $('.tab-preview'));
		preview.setAttribute('aria-hidden', 'true');

		this.appendLine(preview, '1', [
			['export ', 'tok-keyword'], ['function ', 'tok-keyword'], ['generatePalette', 'tok-function'], ['(', 'tok-plain'],
		]);

		const line2 = this.createGhostLine(preview, '2', [
			['  ', 'tok-plain'], ['baseHex', 'tok-parameter'], [': ', 'tok-plain'], ['string', 'tok-type'], [',', 'tok-plain'],
		], ' steps = 6', false);
		line2.line.classList.add('highlighted');
		line2.ghost.classList.add('tab-ghost-active');

		this.appendLine(preview, '3', [['): ', 'tok-plain'], ['string', 'tok-type'], ['[] {', 'tok-plain']]);
		this.appendLine(preview, '4', [
			['  ', 'tok-plain'], ['const', 'tok-keyword'], [' ', 'tok-plain'], ['colors', 'tok-plain'], [' = []', 'tok-plain'],
		]);

		const line5 = this.createGhostLine(preview, '5', [['  ', 'tok-plain'], ['for (let i', 'tok-plain']], ' = 0; i < steps; i++) {');
		const line6 = this.createGhostLine(preview, '6', [
			['    ', 'tok-plain'], ['const', 'tok-keyword'], [' hue = (i / steps) * 360', 'tok-plain'],
		], ';');
		const line7 = this.createGhostLine(preview, '7', [
			['    ', 'tok-plain'], ['colors', 'tok-plain'], ['.push(', 'tok-plain'],
		], 'hslToHex(hue)');
		const line8 = this.createGhostLine(preview, '8', [['  ', 'tok-plain'], ['}', 'tok-plain']], '');
		hide(line8.ghost);
		hide(line8.cursor);
		const line9 = this.createGhostLine(preview, '9', [['  ', 'tok-plain'], ['return', 'tok-keyword'], [' colors', 'tok-plain']], ';');
		const line10 = this.createGhostLine(preview, '10', [['}', 'tok-plain']], '');
		const line12 = this.createGhostLine(preview, '12', [
			['export ', 'tok-keyword'], ['function ', 'tok-keyword'], ['deriveShade', 'tok-function'], ['(', 'tok-plain'],
		], 'baseHex: string, amount: number');
		const line13 = this.createGhostLine(preview, '13', [['): ', 'tok-plain'], ['string', 'tok-type'], [' {', 'tok-plain']], '');
		const line14 = this.createGhostLine(preview, '14', [
			['  ', 'tok-plain'], ['return', 'tok-keyword'], [' mixHex(baseHex, amount)', 'tok-plain'],
		], ';');

		hide(line10.ghost);
		hide(line10.cursor);
		for (const line of [line12, line13, line14]) {
			hide(line.line);
			hide(line.ghost);
			hide(line.cursor);
		}

		const hint = append(editor, $('.tab-completion-hint'));
		append(hint, $('kbd.tab-completion-key', undefined, 'Tab'));
		append(hint, $('span.tab-completion-hint-text', undefined, localize('onboarding.tab.accept', 'to accept')));

		this.element.setAttribute('role', 'region');
		this.element.setAttribute('aria-label', localize('onboarding.tab.region', 'Tab completion preview'));

		registerGhostSequence((d) => this._register(d), [
			{ ...line2, showAt: 0, acceptAt: 1800 },
			{ ...line5, showAt: 2500, acceptAt: 4000 },
			{ ...line6, showAt: 4700, acceptAt: 6100 },
			{ ...line7, showAt: 6800, acceptAt: 8200 },
			{ ...line8, showAt: 8900, acceptAt: 10200 },
			{ ...line9, showAt: 10900, acceptAt: 12300 },
			{ ...line10, showAt: 13000, acceptAt: -1 },
			{ ...line12, showAt: 14200, acceptAt: 15800 },
			{ ...line13, showAt: 16500, acceptAt: 17900 },
			{ ...line14, showAt: 18600, acceptAt: 20000 },
		]);
	}

	private createGhostLine(
		parent: HTMLElement,
		lineNumber: string,
		tokens: [string, string][],
		ghostText: string,
		hidden = true,
	): IGhostLine {
		const line = append(parent, $('.tab-code-line'));
		if (hidden) {
			hide(line);
		}
		append(line, $('.tab-gutter', undefined, lineNumber));
		const content = append(line, $('.tab-content'));
		for (const [text, cls] of tokens) {
			this.appendToken(content, text, cls);
		}
		const ghost = ghostText
			? append(content, $('span.tok-ghost', undefined, ghostText))
			: append(content, $('span.tok-ghost'));
		if (hidden && ghostText) {
			hide(ghost);
		}
		const cursor = append(content, $('.tab-cursor'));
		if (hidden) {
			hide(cursor);
		}
		return { line, ghost, cursor, showAt: 0, acceptAt: 0 };
	}

	private appendLine(parent: HTMLElement, lineNumber: string, tokens: [string, string][]): void {
		const line = append(parent, $('.tab-code-line'));
		append(line, $('.tab-gutter', undefined, lineNumber));
		const content = append(line, $('.tab-content'));
		for (const [text, cls] of tokens) {
			this.appendToken(content, text, cls);
		}
	}

	private appendToken(parent: HTMLElement, text: string, tokenClass: string): HTMLElement {
		return append(parent, $(`span.${tokenClass}`, undefined, text));
	}
}

export class AgentFeaturePreview extends OnboardingFeaturePreview {
	constructor(container: HTMLElement) {
		super('agent-feature-preview');
		this.mountRoot(container);

		const panel = append(this.element, $('.agent-panel'));
		const stack = append(panel, $('.agent-toolcalls-stack'));
		append(
			stack,
			$(
				'.agent-user-prompt',
				undefined,
				localize(
					'onboarding.agent.prompt',
					'Where are these menu label colors defined?',
				),
			),
		);

		const list = append(stack, $('ul.agent-toolcalls-list'));

		this.element.setAttribute('role', 'region');
		this.element.setAttribute(
			'aria-label',
			localize('onboarding.agent.toolcalls', 'Tool calls'),
		);

		const calls: IToolCallRow[] = [
			this.createToolCall(
				list,
				localize('onboarding.agent.grepped', 'Grepped'),
				localize('onboarding.agent.grepDetail', 'themeColors.ts'),
			),
			this.createToolCall(
				list,
				localize('onboarding.agent.read', 'Read'),
				localize('onboarding.agent.readDetail', 'workbenchThemeService.ts'),
			),
			this.createToolCall(
				list,
				localize('onboarding.agent.listed', 'Listed'),
				localize('onboarding.agent.listDetail', 'menu label definitions'),
			),
			this.createToolCall(
				list,
				localize('onboarding.agent.read', 'Read'),
				localize('onboarding.agent.readRegistry', 'colorRegistry.ts'),
			),
			this.createToolCall(
				list,
				localize('onboarding.agent.edited', 'Edited'),
				localize('onboarding.agent.editDetail', 'colorTheme.ts'),
			),
			this.createToolCall(
				list,
				localize('onboarding.agent.traced', 'Traced'),
				localize('onboarding.agent.traceDetail', 'menu label references'),
			),
			this.createToolCall(
				list,
				localize('onboarding.agent.searching', 'Searching'),
				localize('onboarding.agent.searchDetail', 'menu label colors'),
			),
		];

		for (const call of calls) {
			hide(call.item);
		}

		registerToolCallSequence((d) => this._register(d), calls, [
			{ show: 500, complete: 1800 },
			{ show: 2100, complete: 3400 },
			{ show: 3700, complete: 5000 },
			{ show: 5300, complete: 6600 },
			{ show: 6900, complete: 8200 },
			{ show: 8500, complete: 9800 },
			{ show: 10100 },
		]);
	}

	private createToolCall(
		list: HTMLElement,
		verb: string,
		detail: string,
	): IToolCallRow {
		const item = append(list, $('li.agent-toolcall-item'));
		const row = append(item, $('.agent-toolcall-row'));
		const status = append(
			row,
			$('span.agent-toolcall-status.codicon.codicon-loading.codicon-modifier-spin'),
		);
		status.setAttribute('aria-hidden', 'true');
		const verbEl = append(row, $('span.agent-toolcall-verb', undefined, verb));
		const detailEl = append(
			row,
			$('span.agent-toolcall-detail', undefined, detail),
		);
		return { item, row, verb: verbEl, detail: detailEl };
	}
}

export class PlanFeaturePreview extends OnboardingFeaturePreview {
	constructor(container: HTMLElement) {
		super('plan-feature-preview');
		this.mountRoot(container);

		const panel = append(this.element, $('.plan-panel'));
		const stack = append(panel, $('.plan-todo-stack'));

		this.element.setAttribute('role', 'region');
		this.element.setAttribute(
			'aria-label',
			localize('onboarding.plan.region', 'Plan todos preview'),
		);

		const creating = append(stack, $('.plan-creating-banner'));
		append(
			creating,
			$(
				'span.plan-creating-shimmer',
				undefined,
				localize('onboarding.plan.creating', 'Creating plan…'),
			),
		);

		const widget = append(stack, $('.plan-todo-widget'));
		hide(widget);

		const header = append(widget, $('.plan-todo-widget-header'));
		const titleSection = append(header, $('.plan-todo-title-section'));
		append(
			titleSection,
			$('span.codicon.codicon-checklist.plan-todo-header-icon'),
		);
		append(
			titleSection,
			$(
				'.plan-todo-widget-title',
				undefined,
				localize('onboarding.plan.todosTitle', 'To-dos'),
			),
		);
		const countEl = append(
			titleSection,
			$('.plan-todo-widget-count', undefined, '0'),
		);
		append(
			header,
			$('span.codicon.codicon-chevron-down.plan-todo-chevron'),
		);

		const list = append(widget, $('ul.plan-todo-list'));
		const itemTexts = [
			localize(
				'onboarding.plan.item1',
				'Examine authentication flow across the codebase',
			),
			localize(
				'onboarding.plan.item2',
				'Check package.json for session dependencies',
			),
			localize(
				'onboarding.plan.item3',
				'Create OAuth configuration and callback routes',
			),
			localize(
				'onboarding.plan.item4',
				'Wire session middleware into the app entry point',
			),
			localize(
				'onboarding.plan.item5',
				'Add tests for the complete OAuth flow',
			),
			localize(
				'onboarding.plan.item6',
				'Verify login works in development',
			),
		];

		const rows: IPlanTodoRow[] = [];
		for (const text of itemTexts) {
			const item = append(list, $('li.plan-todo-item'));
			hide(item);
			const icon = append(
				item,
				$('span.todo-status-icon.codicon.codicon-circle-outline'),
			);
			icon.setAttribute('aria-hidden', 'true');
			const textEl = append(item, $('.plan-todo-text', undefined, text));
			rows.push({ item, icon, text: textEl });
		}

		const total = rows.length;

		schedule(
			(d) => this._register(d),
			() => {
				hide(creating);
				show(widget);
				widget.classList.add('plan-widget-enter');
			},
			700,
		);

		const revealAt = [1100, 1450, 1800, 2150, 2500, 2850];
		for (let i = 0; i < rows.length; i++) {
			const row = rows[i]!;
			schedule(
				(d) => this._register(d),
				() => {
					show(row.item);
					row.item.classList.add('plan-todo-enter');
					countEl.textContent = String(i + 1);
				},
				revealAt[i]!,
			);
		}

		const workStart = 3400;
		const stepMs = 1600;
		for (let i = 0; i < rows.length; i++) {
			const row = rows[i]!;
			const start = workStart + i * stepMs;
			const done = i < rows.length - 1 ? start + 1300 : -1;

			schedule(
				(d) => this._register(d),
				() => {
					for (const other of rows) {
						other.item.classList.remove('plan-todo-item-active');
						other.text.classList.remove('plan-todo-shimmer');
						if (
							!other.item.classList.contains('plan-todo-item-complete') &&
							other !== row
						) {
							other.icon.className =
								'todo-status-icon codicon codicon-circle-outline';
						}
					}

					row.icon.className =
						'todo-status-icon codicon codicon-loading codicon-modifier-spin plan-todo-progress';
					row.item.classList.add('plan-todo-item-active');
					row.text.classList.add('plan-todo-shimmer');
					countEl.textContent = String(total);
				},
				start,
			);

			if (done > 0) {
				schedule(
					(d) => this._register(d),
					() => {
						row.icon.className =
							'todo-status-icon codicon codicon-check plan-todo-done';
						row.item.classList.remove('plan-todo-item-active');
						row.text.classList.remove('plan-todo-shimmer');
						row.item.classList.add('plan-todo-item-complete');
					},
					done,
				);
			}
		}
	}
}
