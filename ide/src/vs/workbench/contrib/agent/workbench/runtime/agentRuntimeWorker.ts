/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { parentPort } from 'node:worker_threads';
import type { FromIdeProtocol, ToCoreProtocol } from '../../core/protocol';
import type { AutocompleteInput } from '../../core/autocomplete/util/types';
import type { Message } from '../../core/protocol/messenger';
import { AgentRuntime } from './AgentRuntime';

type WorkerRequest =
	| { kind: 'invoke'; id: string; messageType: string; data: unknown }
	| { kind: 'complete'; id: string; data: unknown }
	| { kind: 'acceptCompletion'; data: string }
	| { kind: 'cancelCompletion'; data: string }
	| { kind: 'ideEvent'; messageType: string; data: unknown }
	| {
		kind: 'hostResponse';
		id: string;
		value?: unknown;
		error?: { message: string; stack?: string };
	}
	| { kind: 'dispose' };

function getParentPort(): NonNullable<typeof parentPort> {
	if (!parentPort) {
		throw new Error('Quantum Agent runtime must run in a worker thread.');
	}
	return parentPort;
}
const port = getParentPort();

let nextRequestId = 0;
const pendingHostRequests = new Map<string, { resolve(value: unknown): void; reject(error: Error): void }>();
const completionControllers = new Map<string, AbortController>();
const MAX_INVOKE_CHUNK_BATCH_SIZE = 32;

function requestHost(kind: 'ide' | 'core', messageType: string, data: unknown): Promise<unknown> {
	const id = `host-${++nextRequestId}`;
	return new Promise((resolve, reject) => {
		pendingHostRequests.set(id, { resolve, reject });
		port.postMessage({ kind: 'hostRequest', id, requestKind: kind, messageType, data });
	});
}

function emitCoreMessage(message: Message): void {
	port.postMessage({ kind: 'coreMessage', message });
}

const runtime = new AgentRuntime(
	(messageType, data) => requestHost('ide', String(messageType), data),
	(messageType, data) => requestHost('core', String(messageType), data),
	emitCoreMessage,
);

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
	return typeof value === 'object' && value !== null && Symbol.asyncIterator in value;
}

function serializeError(error: unknown): { message: string; stack?: string } {
	if (error instanceof Error) {
		return { message: error.message, stack: error.stack };
	}
	return { message: String(error) };
}

async function handleInvoke(request: WorkerRequest): Promise<void> {
	if (request.kind !== 'invoke') {
		throw new Error('Invalid Agent invocation message.');
	}
	const { id, messageType, data } = request;

	let chunks: unknown[] = [];
	let flushHandle: ReturnType<typeof setImmediate> | undefined;
	const flushChunks = () => {
		if (flushHandle) {
			clearImmediate(flushHandle);
			flushHandle = undefined;
		}
		if (chunks.length > 0) {
			const contents = chunks;
			chunks = [];
			port.postMessage({ kind: 'invokeChunk', id, contents });
		}
	};
	try {
		const runtimeMessageType = messageType as keyof ToCoreProtocol;
		const runtimeData = data as ToCoreProtocol[typeof runtimeMessageType][0];
		const result = await runtime.invoke(runtimeMessageType, runtimeData, id);
		if (!isAsyncIterable(result)) {
			port.postMessage({ kind: 'invokeResult', id, value: result });
			return;
		}

		const iterator = result[Symbol.asyncIterator]();
		while (true) {
			const next = await iterator.next();
			if (next.done) {
				flushChunks();
				port.postMessage({ kind: 'invokeResult', id, value: next.value });
				return;
			}
			chunks.push(next.value);
			if (chunks.length >= MAX_INVOKE_CHUNK_BATCH_SIZE) {
				flushChunks();
				continue;
			}
			flushHandle ??= setImmediate(() => {
				flushHandle = undefined;
				flushChunks();
			});
		}
	} catch (error) {
		flushChunks();
		port.postMessage({ kind: 'invokeResult', id, error: serializeError(error) });
	}
}

async function handleCompletion(request: WorkerRequest): Promise<void> {
	if (request.kind !== 'complete') {
		return;
	}
	const { id, data } = request;
	const controller = new AbortController();
	completionControllers.set(id, controller);
	try {
		const outcome = await runtime.complete(data as AutocompleteInput, controller.signal);
		port.postMessage({ kind: 'invokeResult', id, value: outcome });
	} catch (error) {
		port.postMessage({ kind: 'invokeResult', id, error: serializeError(error) });
	} finally {
		completionControllers.delete(id);
	}
}

port.on('message', (request: WorkerRequest) => {
	if (request.kind === 'dispose') {
		for (const controller of completionControllers.values()) {
			controller.abort();
		}
		completionControllers.clear();
		for (const pending of pendingHostRequests.values()) {
			pending.reject(new Error('Quantum Agent runtime is shutting down.'));
		}
		pendingHostRequests.clear();
		void runtime.dispose().catch(error => {
			console.error('[Agent] Runtime cleanup failed', error);
		}).finally(() => {
			port.postMessage({ kind: 'disposed' });
		});
		return;
	}

	if (request.kind === 'hostResponse') {
		const pending = pendingHostRequests.get(request.id);
		if (pending) {
			pendingHostRequests.delete(request.id);
			if (request.error) {
				pending.reject(Object.assign(new Error(request.error.message), { stack: request.error.stack }));
			} else {
				pending.resolve(request.value);
			}
		}
		return;
	}

	if (request.kind === 'ideEvent') {
		const messageType = request.messageType as keyof FromIdeProtocol;
		const data = request.data as FromIdeProtocol[typeof messageType][0];
		runtime.acceptIdeEvent(messageType, data);
		return;
	}

	if (request.kind === 'invoke') {
		void handleInvoke(request);
		return;
	}

	if (request.kind === 'complete') {
		void handleCompletion(request);
		return;
	}

	if (request.kind === 'acceptCompletion') {
		runtime.acceptCompletion(request.data);
		return;
	}

	if (request.kind === 'cancelCompletion') {
		completionControllers.get(request.data)?.abort();
	}
});
