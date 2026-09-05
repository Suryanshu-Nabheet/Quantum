/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { Disposable } from '../../../../base/common/lifecycle.js';
import { mainWindow } from '../../../../base/browser/window.js';
import { IOnboardingService, IOnboardingState } from '../common/onboardingTypes.js';
import { OnboardingState } from './onboardingState.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { OnboardingView } from './onboardingView.js';
import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';

export class OnboardingService extends Disposable implements IOnboardingService {

	readonly _serviceBrand: undefined;

	private readonly _state: OnboardingState;
	private _view: OnboardingView | undefined;

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
	) {
		super();
		this._state = this._register(this.instantiationService.createInstance(OnboardingState));

		this._register({
			dispose: () => {
				this.setOnboardingActive(false);
			}
		});
	}

	get state(): IOnboardingState {
		return this._state.state;
	}

	show(): void {
		if (!this._view) {
			this._view = this._register(this.instantiationService.createInstance(OnboardingView));
		}

		this.setOnboardingActive(true);
		this._view.show();
	}

	hide(): void {
		if (this._view) {
			this._view.hide();
		}

		this.setOnboardingActive(false);
		this.layoutService.layout();
	}

	reset(): void {
		this._state.updateState({ completed: false });
		this.show();
	}

	saveState(state: Partial<IOnboardingState>): void {
		this._state.updateState(state);
	}

	private setOnboardingActive(active: boolean): void {
		const workbenchContainer = this.layoutService.getContainer(mainWindow);
		workbenchContainer?.classList.toggle('quantum-onboarding-active', active);
	}
}
