/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { parentPort } from 'node:worker_threads';
import type { FromIdeProtocol, ToCoreProtocol } from '../../core/protocol';
import type { AutocompleteInput } from '../../core/autocomplete/util/types';
import type { Message } from '../../core/protocol/messenger';
import { AgentRuntime } from './AgentRuntime';

interface WorkerRequest {
	kind: 'invoke' | 'complete' | 'acceptCompletion' | 'cancelCompletion' | 'ideEvent' | 'hostResponse' | 'dispose';
	id?: string;
	messageType?: string;
	data?: unknown;
	value?: unknown;
	error?: { message: string; stack?: string };
}

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
	const id = request.id;
	if (!id || !request.messageType) {
		throw new Error('Invalid Agent invocation message.');
	}

	try {
		const messageType = request.messageType as keyof ToCoreProtocol;
		const data = request.data as ToCoreProtocol[typeof messageType][0];
		const result = await runtime.invoke(messageType, data, id);
		if (!isAsyncIterable(result)) {
			port.postMessage({ kind: 'invokeResult', id, value: result });
			return;
		}

		const iterator = result[Symbol.asyncIterator]();
		while (true) {
			const next = await iterator.next();
			if (next.done) {
				port.postMessage({ kind: 'invokeResult', id, value: next.value });
				return;
			}
			port.postMessage({ kind: 'invokeChunk', id, content: next.value, done: false });
		}
	} catch (error) {
		port.postMessage({ kind: 'invokeResult', id, error: serializeError(error) });
	}
}

async function handleCompletion(request: WorkerRequest): Promise<void> {
	if (!request.id) {
		return;
	}
	const controller = new AbortController();
	completionControllers.set(request.id, controller);
	try {
		const outcome = await runtime.complete(request.data as AutocompleteInput, controller.signal);
		port.postMessage({ kind: 'invokeResult', id: request.id, value: outcome });
	} catch (error) {
		port.postMessage({ kind: 'invokeResult', id: request.id, error: serializeError(error) });
	} finally {
		completionControllers.delete(request.id);
	}
}

port.on('message', (request: WorkerRequest) => {
	if (request.kind === 'dispose') {
		runtime.dispose();
		return;
	}

	if (request.kind === 'hostResponse' && request.id) {
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

	if (request.kind === 'ideEvent' && request.messageType) {
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

	if (request.kind === 'acceptCompletion' && typeof request.data === 'string') {
		runtime.acceptCompletion(request.data);
		return;
	}

	if (request.kind === 'cancelCompletion') {
		if (typeof request.data === 'string') {
			completionControllers.get(request.data)?.abort();
		}
	}
});
