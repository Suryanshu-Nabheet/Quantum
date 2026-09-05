/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';

export const QUANTUM_ONBOARDING_CONFIGURATION_KEY = 'workbench.welcomePage.experimentalOnboarding';

export function isQuantumOnboardingEnabled(configurationService: IConfigurationService): boolean {
	return configurationService.getValue<boolean>(QUANTUM_ONBOARDING_CONFIGURATION_KEY) !== false;
}

export const IOnboardingService = createDecorator<IOnboardingService>('onboardingService');

export interface IOnboardingService {
	readonly _serviceBrand: undefined;

	readonly state: IOnboardingState;

	show(): void;
	hide(): void;
	reset(): void;

	saveState(state: Partial<IOnboardingState>): void;
}

export interface IOnboardingState {
	completed: boolean;
	currentStep?: number;
	totalSteps?: number;
	model?: string;
	apiKey?: string;
	theme?: 'light' | 'dark';
	layout?: 'sidebar' | 'floating';
	density?: 'compact' | 'comfortable';
}

export interface IOnboardingStep extends IDisposable {
	readonly element: HTMLElement;
	readonly title?: string;
	readonly canProceed?: boolean;
	updateState?(state: IOnboardingState): void;
	onEnter?(): void;
	onExit?(): void;
}

export interface IFeatureCard {
	id: string;
	title: string;
	description: string;
	shortcut: string;
	icon?: string;
	animationDelay?: number;
}
