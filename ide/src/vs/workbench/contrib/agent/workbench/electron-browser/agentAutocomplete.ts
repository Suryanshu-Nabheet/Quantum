/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Action2, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IInstantiationService, ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILanguageFeaturesService } from '../../../../../editor/common/services/languageFeatures.js';
import { InlineCompletion, InlineCompletions, InlineCompletionsProvider, InlineCompletionContext } from '../../../../../editor/common/languages.js';
import { ITextModel } from '../../../../../editor/common/model.js';
import { IWorkbenchContribution, WorkbenchPhase, registerWorkbenchContribution2 } from '../../../../common/contributions.js';
import { IAgentNativeService } from './agentNativeService.js';

const PREFIX_LINES = 96;
const SUFFIX_LINES = 48;
const PREFIX_LIMIT = 16_000;
const SUFFIX_LIMIT = 6_000;

class AgentInlineCompletionProvider extends Disposable implements InlineCompletionsProvider {
	constructor(
		@IAgentNativeService private readonly agentService: IAgentNativeService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
	) {
		super();
	}

	async provideInlineCompletions(model: ITextModel, position: { lineNumber: number; column: number }, context: InlineCompletionContext, token: CancellationToken): Promise<InlineCompletions | undefined> {
		if (token.isCancellationRequested || this.configurationService.getValue<boolean>('agent.enableTabAutocomplete') === false || model.uri.scheme === 'vscode-scm') {
			return undefined;
		}

		const line = position.lineNumber - 1;
		const column = position.column - 1;
		const startLine = Math.max(0, line - PREFIX_LINES + 1);
		const endLine = Math.min(model.getLineCount() - 1, line + SUFFIX_LINES - 1);
		const prefix = model.getValueInRange({ startLineNumber: startLine + 1, startColumn: 1, endLineNumber: position.lineNumber, endColumn: position.column }).slice(-PREFIX_LIMIT);
		const suffix = model.getValueInRange({ startLineNumber: position.lineNumber, startColumn: position.column, endLineNumber: endLine + 1, endColumn: model.getLineMaxColumn(endLine + 1) }).slice(0, SUFFIX_LIMIT);
		const selected = context.selectedSuggestionInfo;
		const completionId = context.requestUuid;

		const cancellation = token.onCancellationRequested(() => void this.agentService.cancelCompletion(completionId));
		try {
			const outcome = await this.agentService.complete({
				isUntitledFile: model.uri.scheme === 'untitled',
				completionId,
				filepath: model.uri.toString(),
				pos: { line, character: column },
				manuallyPassPrefix: prefix,
				manuallyPassSuffix: suffix,
				selectedCompletionInfo: selected ? {
					text: selected.text,
					range: {
						start: { line: selected.range.startLineNumber - 1, character: selected.range.startColumn - 1 },
						end: { line: selected.range.endLineNumber - 1, character: selected.range.endColumn - 1 },
					},
				} : undefined,
			});
			if (!outcome || token.isCancellationRequested || !outcome.completion) {
				return undefined;
			}

			const item: InlineCompletion = {
				insertText: outcome.completion,
				...(selected ? { range: selected.range } : {}),
				command: { id: 'agent.internal.acceptAutocomplete', title: 'Accept Agent completion', arguments: [outcome.completionId] },
			};
			return { items: [item], enableForwardStability: true };
		} finally {
			cancellation.dispose();
		}
	}

	disposeInlineCompletions(_completions: InlineCompletions): void { }
}

class AgentAutocompleteContribution extends Disposable implements IWorkbenchContribution {
	constructor(@ILanguageFeaturesService languageFeaturesService: ILanguageFeaturesService, @IInstantiationService instantiationService: IInstantiationService) {
		super();
		const provider = this._register(instantiationService.createInstance(AgentInlineCompletionProvider));
		this._register(languageFeaturesService.inlineCompletionsProvider.register({ pattern: '**' }, provider));
	}
}

registerWorkbenchContribution2('workbench.contrib.agentAutocomplete', AgentAutocompleteContribution, WorkbenchPhase.BlockRestore);

registerAction2(class AcceptAgentAutocompleteAction extends Action2 {
	constructor() {
		super({ id: 'agent.internal.acceptAutocomplete', title: 'Accept Agent completion', f1: false });
	}
	run(accessor: ServicesAccessor, completionId?: string): Promise<void> {
		return completionId ? accessor.get(IAgentNativeService).acceptCompletion(completionId) : Promise.resolve();
	}
});
