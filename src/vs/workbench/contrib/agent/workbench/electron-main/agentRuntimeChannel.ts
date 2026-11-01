/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IChannel, IServerChannel, IPCServer } from '../../../../../base/parts/ipc/common/ipc.js';
import { ILogService } from '../../../../../platform/log/common/log.js';

type IAgentWorkerMessage =
	| {
		readonly kind: 'hostRequest';
		readonly id: string;
		readonly requestKind: 'ide' | 'core';
		readonly messageType: string;
		readonly data: unknown;
	}
	| { readonly kind: 'coreMessage'; readonly message: unknown }
	| { readonly kind: 'invokeChunk'; readonly id: string; readonly contents: unknown[] }
	| { readonly kind: 'disposed' }
	| {
		readonly kind: 'invokeResult';
		readonly id: string;
		readonly value?: unknown;
		readonly error?: { message: string; stack?: string };
	};

interface IAgentInvocation {
	readonly id: string;
	readonly messageType: string;
	readonly data: unknown;
}

type IAgentInvocationRequest =
	| { readonly kind: 'invoke'; readonly messageType: string; readonly data: unknown }
	| { readonly kind: 'complete'; readonly data: unknown };

interface IAgentWorker {
	readonly worker: Worker;
	readonly workbenchChannel: IChannel;
	readonly pendingInvocations: Map<string, { resolve(value: unknown): void; reject(error: Error): void }>;
	readonly pendingChunkDeliveries: Map<string, Promise<void>>;
	disposeTimeout?: ReturnType<typeof setTimeout>;
}

export class AgentRuntimeChannel extends Disposable implements IServerChannel<string> {
	private readonly workers = new Map<string, IAgentWorker>();
	private nextInvocationId = 0;

	constructor(
		private readonly server: IPCServer<string>,
		private readonly appRoot: string,
		private readonly userHome: string,
		private readonly logService: ILogService,
	) {
		super();
		this._register(server.onDidRemoveConnection(connection => this.disposeWindow(connection.ctx)));
	}

	call<T>(context: string, command: string, arg?: any, _cancellationToken?: CancellationToken): Promise<T> {
		switch (command) {
			case 'invoke':
				return this.invoke(context, arg as IAgentInvocation) as Promise<T>;
			case 'complete':
				return this.complete(context, arg) as Promise<T>;
			case 'acceptCompletion':
				return this.sendToWorker(context, { kind: 'acceptCompletion', data: arg }) as Promise<T>;
			case 'cancelCompletion':
				return this.sendToWorker(context, { kind: 'cancelCompletion', data: arg }) as Promise<T>;
			case 'ideEvent':
				return this.sendToWorker(context, {
					kind: 'ideEvent',
					messageType: (arg as { messageType: string }).messageType,
					data: (arg as { data: unknown }).data,
				}) as Promise<T>;
			case 'dispose':
				this.disposeWindow(context);
				return Promise.resolve(undefined as T);
			default:
				return Promise.reject(new Error(`Unknown Agent runtime command: ${command}`));
		}
	}

	listen(_context: string, _event: string, _arg?: unknown): never {
		throw new Error('Agent runtime events are relayed over the registered workbench channel.');
	}

	private async invoke(context: string, invocation: IAgentInvocation): Promise<unknown> {
		const agent = await this.getOrCreateWorker(context);
		const id = invocation.id || `invoke-${++this.nextInvocationId}`;
		return this.requestWorker(agent, id, {
			kind: 'invoke',
			messageType: invocation.messageType,
			data: invocation.data,
		});
	}

	private async sendToWorker(context: string, message: unknown): Promise<void> {
		const agent = await this.getOrCreateWorker(context);
		agent.worker.postMessage(message);
	}

	private async complete(context: string, data: unknown): Promise<unknown> {
		const agent = await this.getOrCreateWorker(context);
		const requestedCompletionId = (data as { completionId?: unknown } | undefined)?.completionId;
		const id = typeof requestedCompletionId === 'string' && requestedCompletionId.length > 0
			? requestedCompletionId
			: `completion-${++this.nextInvocationId}`;
		return this.requestWorker(agent, id, { kind: 'complete', data });
	}

	private requestWorker(agent: IAgentWorker, id: string, request: IAgentInvocationRequest): Promise<unknown> {
		if (agent.pendingInvocations.has(id)) {
			return Promise.reject(new Error(`Duplicate Agent runtime request ID: ${id}`));
		}

		return new Promise((resolve, reject) => {
			agent.pendingInvocations.set(id, { resolve, reject });
			try {
				agent.worker.postMessage({ ...request, id });
			} catch (error) {
				agent.pendingInvocations.delete(id);
				reject(error instanceof Error ? error : new Error(String(error)));
			}
		});
	}

	private async getOrCreateWorker(context: string): Promise<IAgentWorker> {
		const existing = this.workers.get(context);
		if (existing) {
			return existing;
		}

		const runtimePath = join(this.appRoot, 'out', 'agent', 'runtime', 'agentRuntimeWorker.js');
		if (!existsSync(runtimePath)) {
			throw new Error(`Quantum Agent runtime is not built: ${runtimePath}`);
		}

		const agent: IAgentWorker = {
			worker: new Worker(runtimePath, {
				// The shared process may not inherit the same HOME as the IDE's
				// resolved environment. Agent settings are rooted at the IDE user
				// home, so pass that location explicitly to the native worker.
				env: {
					...process.env,
					AGENT_GLOBAL_DIR: process.env.AGENT_GLOBAL_DIR || join(this.userHome, '.agent'),
				},
			}),
			workbenchChannel: this.server.getChannel('agentWorkbench', client => client.ctx === context),
			pendingInvocations: new Map(),
			pendingChunkDeliveries: new Map(),
		};
		this.workers.set(context, agent);
		agent.worker.on('message', message => this.handleWorkerMessage(context, agent, message as IAgentWorkerMessage));
		agent.worker.on('error', error => {
			this.logService.error('[Agent] Native runtime worker failed', error);
			if (this.workers.get(context) === agent) {
				this.disposeWindow(context, false);
			}
		});
		agent.worker.on('exit', code => {
			if (agent.disposeTimeout) {
				clearTimeout(agent.disposeTimeout);
				agent.disposeTimeout = undefined;
			}
			if (this.workers.get(context) !== agent) {
				return;
			}

			this.workers.delete(context);
			const error = new Error(`Quantum Agent runtime worker exited unexpectedly with code ${code}`);
			this.failPendingInvocations(agent, error);
		});
		return agent;
	}

	private handleWorkerMessage(context: string, agent: IAgentWorker, message: IAgentWorkerMessage): void {
		if (message.kind === 'disposed') {
			if (agent.disposeTimeout) {
				clearTimeout(agent.disposeTimeout);
				agent.disposeTimeout = undefined;
			}
			void agent.worker.terminate();
			return;
		}
		if (this.workers.get(context) !== agent) {
			return;
		}

		if (message.kind === 'hostRequest') {
			void agent.workbenchChannel.call('handleRuntimeRequest', {
				requestKind: message.requestKind,
				messageType: message.messageType,
				data: message.data,
			}).then(
				value => this.postHostResponse(context, agent, { kind: 'hostResponse', id: message.id, value }),
				error => this.postHostResponse(context, agent, {
					kind: 'hostResponse',
					id: message.id,
					error: { message: error instanceof Error ? error.message : String(error) },
				}),
			);
			return;
		}

		if (message.kind === 'coreMessage') {
			void agent.workbenchChannel.call('handleCoreMessage', message.message).catch(error => {
				this.logService.error('[Agent] Could not deliver runtime message to workbench', error);
			});
			return;
		}

		if (message.kind === 'invokeChunk') {
			const previousDelivery = agent.pendingChunkDeliveries.get(message.id) ?? Promise.resolve();
			const delivery = previousDelivery.then(() =>
				agent.workbenchChannel.call<void>('handleRuntimeChunk', {
					messageId: message.id,
					contents: message.contents,
				}),
			);
			agent.pendingChunkDeliveries.set(message.id, delivery);
			void delivery.catch(error => this.logService.error('[Agent] Could not deliver stream chunk', error));
			return;
		}

		if (message.kind === 'invokeResult') {
			const pending = agent.pendingInvocations.get(message.id);
			if (!pending) {
				return;
			}
			agent.pendingInvocations.delete(message.id);
			const chunkDelivery = agent.pendingChunkDeliveries.get(message.id) ?? Promise.resolve();
			agent.pendingChunkDeliveries.delete(message.id);
			void chunkDelivery.then(() => {
				if (message.error) {
					pending.reject(
						Object.assign(new Error(message.error.message), { stack: message.error.stack }),
					);
				} else {
					pending.resolve(message.value);
				}
			}, error => pending.reject(error instanceof Error ? error : new Error(String(error))));
		}
	}

	private postHostResponse(
		context: string,
		agent: IAgentWorker,
		message: { kind: 'hostResponse'; id: string; value?: unknown; error?: { message: string } },
	): void {
		if (this.workers.get(context) !== agent) {
			return;
		}
		try {
			agent.worker.postMessage(message);
		} catch (error) {
			this.logService.error('[Agent] Could not return a host request to the runtime worker', error);
		}
	}

	private failPendingInvocations(agent: IAgentWorker, error: Error): void {
		for (const pending of agent.pendingInvocations.values()) {
			pending.reject(error);
		}
		agent.pendingInvocations.clear();
		agent.pendingChunkDeliveries.clear();
	}

	private disposeWindow(context: string, graceful = true): void {
		const agent = this.workers.get(context);
		if (!agent) {
			return;
		}
		this.workers.delete(context);
		this.failPendingInvocations(agent, new Error('Quantum Agent workbench window closed.'));
		if (!graceful) {
			void agent.worker.terminate();
			return;
		}
		agent.disposeTimeout = setTimeout(() => {
			agent.disposeTimeout = undefined;
			void agent.worker.terminate();
		}, 7000);
		try {
			agent.worker.postMessage({ kind: 'dispose' });
		} catch {
			clearTimeout(agent.disposeTimeout);
			agent.disposeTimeout = undefined;
			void agent.worker.terminate();
		}
	}

	override dispose(): void {
		for (const context of this.workers.keys()) {
			this.disposeWindow(context);
		}
		super.dispose();
	}
}
