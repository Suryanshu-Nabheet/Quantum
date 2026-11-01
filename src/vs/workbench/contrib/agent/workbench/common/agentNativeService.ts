/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { Event } from '../../../../../base/common/event.js';
import type { IDisposable } from '../../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';

export interface IAgentNativeHostRequest {
	readonly requestKind: 'ide' | 'core';
	readonly messageType: string;
	readonly data: unknown;
}

export interface IAgentNativeInvocation {
	readonly id: string;
	readonly messageType: string;
	readonly data: unknown;
}

export interface IAgentCompletionOutcome {
	readonly completion: string;
	readonly completionId: string;
}

export interface IAgentNativeService {
	readonly _serviceBrand: undefined;
	readonly onDidReceiveCoreMessage: Event<unknown>;
	readonly onDidReceiveRuntimeChunk: Event<{
		readonly messageId: string;
		readonly contents: readonly unknown[];
	}>;
	registerHostRequestHandler(handler: (request: IAgentNativeHostRequest) => Promise<unknown>): IDisposable;
	registerGuiRequestHandler(handler: (messageType: string, data: unknown) => Promise<unknown>): IDisposable;
	registerGuiMessageSender(sender: (messageType: string, data: unknown) => void): IDisposable;
	requestGui(messageType: string, data: unknown): Promise<unknown>;
	sendGuiMessage(messageType: string, data?: unknown): void;
	invoke(invocation: IAgentNativeInvocation): Promise<unknown>;
	complete(input: unknown): Promise<IAgentCompletionOutcome | undefined>;
	acceptCompletion(completionId: string): Promise<void>;
	cancelCompletion(completionId: string): Promise<void>;
	sendIdeEvent(messageType: string, data: unknown): Promise<void>;
}

export const IAgentNativeService = createDecorator<IAgentNativeService>('agentNativeService');
