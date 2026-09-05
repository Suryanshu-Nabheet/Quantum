/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IOnboardingState } from '../common/onboardingTypes.js';

export class OnboardingState extends Disposable {

	private static readonly STORAGE_KEY = 'quantum.onboardingState';
	private static readonly LEGACY_STORAGE_KEY = 'codex.onboardingState';

	private readonly _onDidChange = this._register(new Emitter<IOnboardingState>());
	readonly onDidChange: Event<IOnboardingState> = this._onDidChange.event;

	private _state: IOnboardingState;

	constructor(
		@IStorageService private readonly storageService: IStorageService
	) {
		super();
		this._state = this.loadState();
	}

	get state(): IOnboardingState {
		return this._state;
	}

	private loadState(): IOnboardingState {
		let stored = this.storageService.get(OnboardingState.STORAGE_KEY, StorageScope.APPLICATION);
		if (!stored) {
			stored = this.storageService.get(OnboardingState.LEGACY_STORAGE_KEY, StorageScope.APPLICATION);
			if (stored) {
				this.storageService.store(OnboardingState.STORAGE_KEY, stored, StorageScope.APPLICATION, StorageTarget.USER);
				this.storageService.remove(OnboardingState.LEGACY_STORAGE_KEY, StorageScope.APPLICATION);
			}
		}

		if (stored) {
			try {
				return JSON.parse(stored);
			} catch (e) {
				// ignore
			}
		}

		return {
			completed: false
		};
	}

	updateState(update: Partial<IOnboardingState>): void {
		this._state = { ...this._state, ...update };
		this.storageService.store(OnboardingState.STORAGE_KEY, JSON.stringify(this._state), StorageScope.APPLICATION, StorageTarget.USER);
		this._onDidChange.fire(this._state);
	}
}
