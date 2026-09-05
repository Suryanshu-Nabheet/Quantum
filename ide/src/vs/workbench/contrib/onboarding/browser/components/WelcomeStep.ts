/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, DisposableStore } from '../../../../../base/common/lifecycle.js';
import { $, append, clearNode } from '../../../../../base/browser/dom.js';
import { localize } from '../../../../../nls.js';
import { OS, OperatingSystem } from '../../../../../base/common/platform.js';
import { UILabelProvider } from '../../../../../base/common/keybindingLabels.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { IOnboardingStep } from '../../common/onboardingTypes.js';
import {
	TabFeaturePreview,
	AgentFeaturePreview,
	PlanFeaturePreview,
} from './previews/featurePreviews.js';

interface IFeatureCardDefinition {
	id: string;
	title: string;
	description: string;
	shortcut: string;
}

function primaryModifierChord(key: string): string {
	const labels = UILabelProvider.modifierLabels[OS];
	if (OS === OperatingSystem.Macintosh) {
		return `${labels.metaKey}${key}`;
	}
	return `${labels.ctrlKey}${labels.separator}${key}`;
}

function shiftChord(key: string): string {
	const labels = UILabelProvider.modifierLabels[OS];
	if (OS === OperatingSystem.Macintosh) {
		return `${labels.shiftKey}${key}`;
	}
	return `${labels.shiftKey}${labels.separator}${key}`;
}

export class WelcomeStep extends Disposable implements IOnboardingStep {
	readonly element: HTMLElement;
	readonly title = localize('onboarding.welcomeStep', 'Welcome');
	readonly canProceed = true;

	private readonly _previewStore = this._register(new DisposableStore());
	private readonly _previewHosts = new Map<string, HTMLElement>();

	private get FEATURE_CARDS(): IFeatureCardDefinition[] {
		return [
			{
				id: 'tab',
				title: localize('onboarding.feature.tab.title', 'Tab'),
				description: localize(
					'onboarding.feature.tab.desc',
					'Accept intelligent completions as you type',
				),
				shortcut: 'Tab',
			},
			{
				id: 'agent',
				title: localize('onboarding.feature.agent.title', 'Agent'),
				description: localize(
					'onboarding.feature.agent.desc',
					'Ask questions and make changes across your codebase',
				),
				shortcut: primaryModifierChord('I'),
			},
			{
				id: 'plan',
				title: localize('onboarding.feature.plan.title', 'Plan'),
				description: localize(
					'onboarding.feature.plan.desc',
					'Break down complex work into clear, actionable steps',
				),
				shortcut: shiftChord('Tab'),
			},
		];
	}

	constructor(
		@IProductService private readonly productService: IProductService,
	) {
		super();
		this.element = $('.onboarding-step.welcome-features-step');
		this.element.classList.add('feature-cards-step');
		this.render();
	}

	private render(): void {
		const container = append(this.element, $('.onboarding-v2-container'));

		const header = append(container, $('.onboarding-v2-welcome-header'));
		const headerContent = append(header, $('.onboarding-v2-welcome-header-content'));

		const brand = append(headerContent, $('.onboarding-brand'));
		const lockup = append(brand, $('h1.onboarding-brand-lockup'));
		lockup.setAttribute('aria-label', this.productService.nameShort);
		lockup.title = this.productService.nameShort;

		append(
			headerContent,
			$(
				'p.onboarding-v2-welcome-subtitle',
				undefined,
				localize(
					'onboarding.welcomeSub',
					'An open, AI-native code editor built for deep work',
				),
			),
		);

		const grid = append(container, $('.onboarding-v2-quickstart-cards-container'));
		grid.setAttribute('role', 'list');
		grid.setAttribute(
			'aria-label',
			localize('onboarding.features.ariaLabel', 'Key features'),
		);

		this.FEATURE_CARDS.forEach((card) => {
			append(grid, this.createFeatureCard(card));
		});
	}

	private createFeatureCard(card: IFeatureCardDefinition): HTMLElement {
		const cardElement = $('.onboarding-v2-quickstart-card');
		cardElement.setAttribute('data-feature', card.id);
		cardElement.setAttribute('role', 'listitem');

		const content = append(cardElement, $('.onboarding-v2-quickstart-card-content'));
		const header = append(content, $('.onboarding-v2-quickstart-card-header'));
		append(
			header,
			$('span.onboarding-v2-quickstart-card-title', undefined, card.title),
		);
		append(
			header,
			$('kbd.onboarding-v2-quickstart-card-hotkey', undefined, card.shortcut),
		);
		append(
			content,
			$('.onboarding-v2-quickstart-card-desc', undefined, card.description),
		);

		const imageArea = append(cardElement, $('.onboarding-v2-quickstart-card-image'));
		this._previewHosts.set(card.id, imageArea);

		return cardElement;
	}

	private remountPreviews(): void {
		this._previewStore.clear();

		for (const [id, host] of this._previewHosts) {
			clearNode(host);

			switch (id) {
				case 'tab':
					this._previewStore.add(new TabFeaturePreview(host));
					break;
				case 'agent':
					this._previewStore.add(new AgentFeaturePreview(host));
					break;
				case 'plan':
					this._previewStore.add(new PlanFeaturePreview(host));
					break;
			}
		}
	}

	private teardownPreviews(): void {
		this._previewStore.clear();
		for (const host of this._previewHosts.values()) {
			clearNode(host);
		}
	}

	onEnter(): void {
		this.remountPreviews();
	}

	onExit(): void {
		this.teardownPreviews();
	}
}
