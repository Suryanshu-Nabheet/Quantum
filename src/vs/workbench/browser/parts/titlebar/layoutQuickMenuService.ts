/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export const ILayoutQuickMenuService = createDecorator<ILayoutQuickMenuService>('layoutQuickMenuService');

export interface ILayoutQuickMenuOpenSession {
	readonly disposables: DisposableStore;
	dismiss(): void;
}

export interface ILayoutQuickMenuService {
	readonly _serviceBrand: undefined;

	readonly onDidOpen: Event<ILayoutQuickMenuOpenSession>;

	notifyOpen(session: ILayoutQuickMenuOpenSession): void;
}

export class LayoutQuickMenuService extends Disposable implements ILayoutQuickMenuService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidOpen = this._register(new Emitter<ILayoutQuickMenuOpenSession>());
	readonly onDidOpen = this._onDidOpen.event;

	notifyOpen(session: ILayoutQuickMenuOpenSession): void {
		this._onDidOpen.fire(session);
	}
}

registerSingleton(ILayoutQuickMenuService, LayoutQuickMenuService, InstantiationType.Delayed);
