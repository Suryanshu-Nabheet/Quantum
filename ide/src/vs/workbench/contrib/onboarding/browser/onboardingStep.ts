/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposable } from '../../../../base/common/lifecycle.js';
import { IOnboardingState } from '../common/onboardingTypes.js';

export interface IOnboardingStep extends IDisposable {
	readonly element: HTMLElement;
	readonly title?: string;
	readonly canProceed?: boolean;
	updateState?(state: IOnboardingState): void;
	onEnter?(): void;
	onExit?(): void;
}
