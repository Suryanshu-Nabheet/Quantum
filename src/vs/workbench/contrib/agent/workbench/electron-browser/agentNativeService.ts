/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable, toDisposable, type IDisposable } from '../../../../../base/common/lifecycle.js';
import { IChannel, IServerChannel } from '../../../../../base/parts/ipc/common/ipc.js';
import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { ISharedProcessService } from '../../../../../platform/ipc/electron-browser/services.js';
import {
	IAgentNativeService,
	type IAgentNativeHostRequest,
	type IAgentNativeInvocation,
	type IAgentCompletionOutcome,
} from '../common/agentNativeService.js';

/** Owns the renderer side of the Agent's workbench-to-runtime IPC boundary. */
export class AgentNativeService extends Disposable implements IAgentNativeService {
	declare readonly _serviceBrand: undefined;
	private readonly runtimeChannel: IChannel;
	private hostRequestHandler: ((request: IAgentNativeHostRequest) => Promise<unknown>) | undefined;
	private guiRequestHandler: ((messageType: string, data: unknown) => Promise<unknown>) | undefined;
	private guiMessageSender: ((messageType: string, data: unknown) => void) | undefined;
	private readonly coreMessageEmitter = this._register(new Emitter<unknown>());
	private readonly runtimeChunkEmitter = this._register(new Emitter<{ readonly messageId: string; readonly contents: readonly unknown[] }>());
	readonly onDidReceiveCoreMessage = this.coreMessageEmitter.event;
	readonly onDidReceiveRuntimeChunk = this.runtimeChunkEmitter.event;

	constructor(@ISharedProcessService sharedProcessService: ISharedProcessService) {
		super();
		this.runtimeChannel = sharedProcessService.getChannel('agentRuntime');
		sharedProcessService.registerChannel('agentWorkbench', this.createWorkbenchChannel());
	}

	registerHostRequestHandler(handler: (request: IAgentNativeHostRequest) => Promise<unknown>): IDisposable {
		this.hostRequestHandler = handler;
		return toDisposable(() => {
			if (this.hostRequestHandler === handler) {
				this.hostRequestHandler = undefined;
			}
		});
	}

	registerGuiRequestHandler(handler: (messageType: string, data: unknown) => Promise<unknown>): IDisposable {
		this.guiRequestHandler = handler;
		return toDisposable(() => {
			if (this.guiRequestHandler === handler) {
				this.guiRequestHandler = undefined;
			}
		});
	}

	registerGuiMessageSender(sender: (messageType: string, data: unknown) => void): IDisposable {
		this.guiMessageSender = sender;
		return toDisposable(() => {
			if (this.guiMessageSender === sender) {
				this.guiMessageSender = undefined;
			}
		});
	}

	requestGui(messageType: string, data: unknown): Promise<unknown> {
		if (!this.guiRequestHandler) {
			return Promise.reject(new Error('Agent GUI is not ready to handle this request.'));
		}
		return this.guiRequestHandler(messageType, data);
	}

	sendGuiMessage(messageType: string, data?: unknown): void {
		this.guiMessageSender?.(messageType, data);
	}

	invoke(invocation: IAgentNativeInvocation): Promise<unknown> {
		return this.runtimeChannel.call<unknown>('invoke', invocation);
	}

	complete(input: unknown): Promise<IAgentCompletionOutcome | undefined> {
		return this.runtimeChannel.call<IAgentCompletionOutcome | undefined>('complete', input);
	}

	acceptCompletion(completionId: string): Promise<void> {
		return this.runtimeChannel.call<void>('acceptCompletion', completionId);
	}

	cancelCompletion(completionId: string): Promise<void> {
		return this.runtimeChannel.call<void>('cancelCompletion', completionId);
	}

	sendIdeEvent(messageType: string, data: unknown): Promise<void> {
		return this.runtimeChannel.call<void>('ideEvent', { messageType, data });
	}

	private createWorkbenchChannel(): IServerChannel<string> {
		return {
			listen: () => Event.None,
			call: async <T>(_context: string, command: string, arg?: unknown): Promise<T> => {
				switch (command) {
					case 'handleRuntimeRequest':
						if (!this.hostRequestHandler) {
							throw new Error('Agent workbench host is not initialized.');
						}
						return await this.hostRequestHandler(arg as IAgentNativeHostRequest) as T;
					case 'handleCoreMessage':
						this.coreMessageEmitter.fire(arg);
						return undefined as T;
					case 'handleRuntimeChunk':
						this.runtimeChunkEmitter.fire(arg as { messageId: string; contents: readonly unknown[] });
						return undefined as T;
					default:
						throw new Error(`Unknown Agent workbench command: ${command}`);
				}
			},
		};
	}
}

registerSingleton(IAgentNativeService, AgentNativeService, InstantiationType.Delayed);
