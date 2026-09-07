/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import {
	$,
	append,
	addDisposableListener,
} from '../../../../base/browser/dom.js';
import { mainWindow } from '../../../../base/browser/window.js';
import { localize } from '../../../../nls.js';
import { IOnboardingService, IOnboardingStep } from '../common/onboardingTypes.js';
import { WelcomeStep } from './components/WelcomeStep.js';
import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { CustomThemeStep } from './components/CustomThemeStep.js';
import { ImportStep } from './components/ImportStep.js';

import './onboardingStyles.css';

export class OnboardingView extends Disposable {
	private _overlay: HTMLElement | undefined;
	private _container: HTMLElement | undefined;
	private _content: HTMLElement | undefined;
	private _navigation: HTMLElement | undefined;
	private _prevBtn: HTMLButtonElement | undefined;
	private _nextBtn: HTMLButtonElement | undefined;
	private _stepIndicator: HTMLElement | undefined;
	private _finalizingOverlay: HTMLElement | undefined;
	private _completing = false;

	private readonly _steps = [WelcomeStep, ImportStep, CustomThemeStep];
	private readonly _stepInstances: IOnboardingStep[] = [];
	private _currentStep = 0;

	private readonly _productName: string;

	constructor(
		@IOnboardingService private readonly onboardingService: IOnboardingService,
		@IWorkbenchLayoutService
		private readonly layoutService: IWorkbenchLayoutService,
		@IInstantiationService
		private readonly instantiationService: IInstantiationService,
		@IProductService productService: IProductService,
	) {
		super();
		this._productName = productService.nameLong;
	}

	show(): void {
		if (!this._overlay) {
			this.render();
		}
		this._completing = false;
		this._finalizingOverlay?.classList.remove('visible');
		this._overlay!.classList.add('visible');
		this.goStep(0);
		this._nextBtn?.focus();
	}

	hide(): void {
		if (this._overlay) {
			this._overlay.classList.remove('visible');
		}
		// Stop preview timers / animations while the overlay is closed.
		this._stepInstances[this._currentStep]?.onExit?.();
	}

	isVisible(): boolean {
		return this._overlay?.classList.contains('visible') || false;
	}

	private render(): void {
		this._overlay = $('.onboarding-overlay');
		this._overlay.setAttribute('role', 'dialog');
		this._overlay.setAttribute('aria-modal', 'true');
		this._overlay.setAttribute(
			'aria-label',
			localize('onboarding.dialogLabel', 'Welcome to {0}', this._productName),
		);

		this._container = append(this._overlay, $('.onboarding-container'));
		this._content = append(this._container, $('.onboarding-content'));

		this._finalizingOverlay = append(
			this._container,
			$('.onboarding-finalizing-overlay'),
		);
		append(this._finalizingOverlay, $('.finalizing-loader'));
		append(
			this._finalizingOverlay,
			$(
				'.finalizing-text',
				undefined,
				localize('onboarding.setupTitle', 'Setting up {0}', this._productName),
			),
		);
		append(
			this._finalizingOverlay,
			$(
				'.finalizing-subtext',
				undefined,
				localize('onboarding.setupSubtext', 'Almost ready…'),
			),
		);

		this._navigation = append(this._container, $('.onboarding-navigation'));

		const navButtons = append(this._navigation, $('.onboarding-nav-buttons'));
		const navStart = append(navButtons, $('.onboarding-nav-start'));
		const navCenter = append(navButtons, $('.onboarding-nav-center'));
		append(navButtons, $('.onboarding-nav-end'));

		this._prevBtn = append(
			navStart,
			$('button.onboarding-button', {
				type: 'button',
			}),
		) as HTMLButtonElement;
		this._prevBtn.textContent = localize('onboarding.previous', 'Back');
		this._prevBtn.setAttribute(
			'aria-label',
			localize('onboarding.prevStepLabel', 'Previous step'),
		);

		this._nextBtn = append(
			navCenter,
			$('button.onboarding-button.primary', {
				type: 'button',
			}),
		) as HTMLButtonElement;
		this._nextBtn.textContent = localize('onboarding.next', 'Continue');
		this._nextBtn.setAttribute(
			'aria-label',
			localize('onboarding.nextStepLabel', 'Next step'),
		);

		this._stepIndicator = append(
			this._navigation,
			$('.onboarding-step-indicator'),
		);
		this._stepIndicator.setAttribute('role', 'tablist');
		this._stepIndicator.setAttribute(
			'aria-label',
			localize('onboarding.stepsLabel', 'Onboarding steps'),
		);

		this.updatePrevButton();
		this.updateStepIndicator();

		this._register(
			addDisposableListener(this._prevBtn, 'click', () => {
				this.previousStep();
			}),
		);

		this._register(
			addDisposableListener(this._nextBtn, 'click', () => {
				this.nextStep();
			}),
		);

		this._register(
			addDisposableListener(this._overlay, 'keydown', (e) => {
				this.handleKeydown(e);
			}),
		);

		const workbenchContainer = this.layoutService.getContainer(mainWindow);
		if (this._overlay && workbenchContainer) {
			workbenchContainer.appendChild(this._overlay);
		}

		this._steps.forEach((StepClass) => {
			const instance = this.instantiationService.createInstance(StepClass);
			this._stepInstances.push(this._register(instance));
			this._content!.appendChild(instance.element);
		});
	}

	private goStep(index: number): void {
		if (index < 0 || index >= this._stepInstances.length || this._completing) {
			return;
		}

		this._stepInstances[this._currentStep]?.onExit?.();
		this._currentStep = index;

		this._stepInstances.forEach((instance, i) => {
			instance.element.classList.toggle('active', i === index);
		});

		this._stepInstances[this._currentStep]?.onEnter?.();

		this.updateStepIndicator();
		this.updatePrevButton();
		this.updateNextButton();

		this.onboardingService.saveState({
			currentStep: index,
			totalSteps: this._stepInstances.length,
		});
	}

	private nextStep(): void {
		if (this._completing) {
			return;
		}
		if (this._currentStep < this._stepInstances.length - 1) {
			this.goStep(this._currentStep + 1);
		} else {
			void this.completeOnboarding();
		}
	}

	private previousStep(): void {
		if (this._completing) {
			return;
		}
		if (this._currentStep > 0) {
			this.goStep(this._currentStep - 1);
		}
	}

	private async completeOnboarding(): Promise<void> {
		if (this._completing) {
			return;
		}
		this._completing = true;

		const importStep = this._stepInstances.find(
			(s) => s instanceof ImportStep,
		) as ImportStep | undefined;

		if (importStep) {
			this._finalizingOverlay?.classList.add('visible');
			if (this._prevBtn) {
				this._prevBtn.disabled = true;
			}
			if (this._nextBtn) {
				this._nextBtn.disabled = true;
			}
			try {
				await importStep.performMigration();
				await new Promise((resolve) => setTimeout(resolve, 600));
			} catch {
				this._finalizingOverlay?.classList.remove('visible');
			}
		}

		this.onboardingService.saveState({ completed: true });
		this.onboardingService.hide();

		setTimeout(() => {
			this._finalizingOverlay?.classList.remove('visible');
			this._completing = false;
		}, 400);
	}

	private updateStepIndicator(): void {
		if (!this._stepIndicator) {
			return;
		}

		while (this._stepIndicator.firstChild) {
			this._stepIndicator.removeChild(this._stepIndicator.firstChild);
		}

		this._stepInstances.forEach((_, index) => {
			const dot = append(this._stepIndicator!, $('.step-dot'));
			dot.setAttribute('role', 'presentation');
			dot.classList.toggle('active', index === this._currentStep);
			dot.classList.toggle('completed', index < this._currentStep);
		});
	}

	private updatePrevButton(): void {
		if (!this._prevBtn) {
			return;
		}

		const isDisabled = this._currentStep === 0;
		this._prevBtn.disabled = isDisabled;
		this._prevBtn.classList.toggle('is-hidden', isDisabled);
		this._prevBtn.setAttribute('aria-hidden', isDisabled ? 'true' : 'false');
		if (isDisabled) {
			this._prevBtn.tabIndex = -1;
		} else {
			this._prevBtn.removeAttribute('tabindex');
		}
	}

	private updateNextButton(): void {
		if (!this._nextBtn) {
			return;
		}

		const isLastStep = this._currentStep === this._stepInstances.length - 1;
		const currentStepInstance = this._stepInstances[this._currentStep];
		const canProceed = currentStepInstance?.canProceed !== false;

		this._nextBtn.disabled = !canProceed;

		const buttonText = isLastStep
			? localize('onboarding.getStarted', 'Get Started')
			: localize('onboarding.continue', 'Continue');
		if (this._nextBtn.textContent !== buttonText) {
			this._nextBtn.textContent = buttonText;
		}
		this._nextBtn.setAttribute(
			'aria-label',
			isLastStep
				? localize(
					'onboarding.startLabel',
					'Complete onboarding and get started',
				)
				: localize('onboarding.nextStepLabel', 'Next step'),
		);
	}

	private handleKeydown(e: KeyboardEvent): void {
		if (this._completing) {
			return;
		}
		switch (e.key) {
			case 'ArrowLeft':
				e.preventDefault();
				this.previousStep();
				break;
			case 'ArrowRight':
				e.preventDefault();
				this.nextStep();
				break;
			case 'Escape':
				e.preventDefault();
				this.onboardingService.hide();
				break;
			case 'Enter':
				if (e.target === this._nextBtn || e.target === this._prevBtn) {
					return;
				}
				e.preventDefault();
				this.nextStep();
				break;
		}
	}
}
