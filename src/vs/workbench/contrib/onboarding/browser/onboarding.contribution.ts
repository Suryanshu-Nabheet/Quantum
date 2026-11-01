/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from '../../../../platform/registry/common/platform.js';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions, IWorkbenchContribution } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { IOnboardingService, isQuantumOnboardingEnabled } from '../common/onboardingTypes.js';
import { OnboardingService } from './onboardingService.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { registerAction2, Action2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { localize2 } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';

class OnboardingContribution extends Disposable implements IWorkbenchContribution {
	constructor(
		@IOnboardingService private readonly onboardingService: IOnboardingService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
	) {
		super();
		this.maybeShowOnboarding();
	}

	private maybeShowOnboarding(): void {
		if (!isQuantumOnboardingEnabled(this.configurationService)) {
			return;
		}

		if (!this.onboardingService.state.completed) {
			this.onboardingService.show();
		}
	}
}

registerSingleton(IOnboardingService, OnboardingService, InstantiationType.Eager);

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	OnboardingContribution,
	LifecyclePhase.Restored
);

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.resetWelcome',
			title: localize2('onboarding.reset', 'Welcome: Reset'),
			f1: true,
		});
	}

	run(accessor: ServicesAccessor): void {
		const onboardingService = accessor.get(IOnboardingService);
		onboardingService.reset();
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.showWelcome',
			title: localize2('onboarding.show', 'Welcome: Show Onboarding Screen'),
			f1: true,
		});
	}

	run(accessor: ServicesAccessor): void {
		const onboardingService = accessor.get(IOnboardingService);
		onboardingService.show();
	}
});
