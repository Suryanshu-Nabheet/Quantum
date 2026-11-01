/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';

export interface IAgentWorkbenchHost {
	readonly _serviceBrand: undefined;
	handleGuiRequest(messageType: string, payload: unknown): { handled: boolean; value?: unknown };
	openSettingsPage(route?: string): void;
}

export const IAgentWorkbenchHost = createDecorator<IAgentWorkbenchHost>('agentWorkbenchHost');
