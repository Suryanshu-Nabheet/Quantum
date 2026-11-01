/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../../base/common/lifecycle.js';
import { append, $ } from '../../../../../../base/browser/dom.js';

export interface IOnboardingFeaturePreview extends Disposable {
	readonly element: HTMLElement;
}

export abstract class OnboardingFeaturePreview extends Disposable implements IOnboardingFeaturePreview {
	readonly element: HTMLElement;

	protected constructor(className: string) {
		super();
		this.element = $(`.onboarding-feature-preview.${className}`);
		this._register({
			dispose: () => this.element.remove(),
		});
	}

	protected mountRoot(container: HTMLElement): void {
		append(container, this.element);
	}
}
