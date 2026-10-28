/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Core } from '../../core/core';
import type {
	FromCoreProtocol,
	FromIdeProtocol,
	ToCoreProtocol,
} from '../../core/protocol';
import type { ToIdeFromWebviewOrCoreProtocol } from '../../core/protocol/ide';
import { InProcessMessenger, type Message } from '../../core/protocol/messenger';
import { MessageIde } from '../../core/protocol/messenger/messageIde';
import type { IDE } from '../../core';
import type { AutocompleteInput, AutocompleteOutcome } from '../../core/autocomplete/util/types';

type IdeRequest = <T extends keyof ToIdeFromWebviewOrCoreProtocol>(
	messageType: T,
	data: ToIdeFromWebviewOrCoreProtocol[T][0],
) => Promise<ToIdeFromWebviewOrCoreProtocol[T][1]>;

type CoreRequest = <T extends keyof FromCoreProtocol>(
	messageType: T,
	data: FromCoreProtocol[T][0],
) => Promise<FromCoreProtocol[T][1]>;

type CoreMessageHandler = (message: Message) => void;
type IdeEventHandler = (data: unknown) => void;

class AgentRuntimeMessenger extends InProcessMessenger<ToCoreProtocol, FromCoreProtocol> {
	constructor(
		private readonly requestCallback: CoreRequest,
		private readonly emit: CoreMessageHandler,
	) {
		super();
	}

	override send<T extends keyof FromCoreProtocol>(
		messageType: T,
		data: FromCoreProtocol[T][0],
		messageId?: string,
	): string {
		const id = messageId ?? crypto.randomUUID();
		this.emit({ messageType: String(messageType), messageId: id, data });
		return id;
	}

	override request<T extends keyof FromCoreProtocol>(
		messageType: T,
		data: FromCoreProtocol[T][0],
	): Promise<FromCoreProtocol[T][1]> {
		return this.requestCallback(messageType, data);
	}
}

/** Runs Agent Core behind a host-provided IDE request and event bridge. */
export class AgentRuntime {
	private readonly core: Core;
	private readonly initialized: Promise<void>;
	private readonly ideEventHandlers = new Map<keyof FromIdeProtocol, Set<IdeEventHandler>>();
	private readonly ide: IDE;

	constructor(
		requestIde: IdeRequest,
		requestCore: CoreRequest,
		emitCoreMessage: CoreMessageHandler,
	) {
		this.ide = new MessageIde(
			requestIde,
			(messageType, handler) => {
				let handlers = this.ideEventHandlers.get(messageType);
				if (!handlers) {
					handlers = new Set();
					this.ideEventHandlers.set(messageType, handlers);
				}
				handlers.add(handler as IdeEventHandler);
			},
		);

		this.core = new Core(
			new AgentRuntimeMessenger(requestCore, emitCoreMessage),
			this.ide,
		);
		this.initialized = this.core.configHandler.loadConfig().then(async () => {
			const openFiles = await this.ide.getOpenFiles();
			this.core.invoke('files/opened', { uris: openFiles });
		});
	}

	invoke<T extends keyof ToCoreProtocol>(
		messageType: T,
		data: ToCoreProtocol[T][0],
	): Promise<ToCoreProtocol[T][1]> {
		return this.initialized.then(() => this.core.invoke(messageType, data));
	}

	complete(input: AutocompleteInput, signal: AbortSignal): Promise<AutocompleteOutcome | undefined> {
		return this.initialized.then(() => this.core.completionProvider.provideLightweightInlineCompletionItems(input, signal)).then(outcome => {
			if (outcome) {
				this.core.completionProvider.markDisplayed(outcome.completionId, outcome);
			}
			return outcome;
		});
	}

	acceptCompletion(completionId: string): void {
		this.core.completionProvider.accept(completionId);
	}


	acceptIdeEvent<T extends keyof FromIdeProtocol>(
		messageType: T,
		data: FromIdeProtocol[T][0],
	): void {
		for (const handler of this.ideEventHandlers.get(messageType) ?? []) {
			handler(data);
		}
	}

	dispose(): void {
		this.core.dispose();
		this.ideEventHandlers.clear();
	}
}
