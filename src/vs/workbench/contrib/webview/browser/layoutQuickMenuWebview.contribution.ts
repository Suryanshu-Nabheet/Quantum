/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { ILayoutQuickMenuService } from '../../../browser/parts/titlebar/layoutQuickMenuService.js';
import { IWorkbenchContribution, WorkbenchPhase, registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { IWebviewService } from './webview.js';

class LayoutQuickMenuWebviewDismissContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.layoutQuickMenuWebviewDismiss';

	constructor(
		@ILayoutQuickMenuService layoutQuickMenuService: ILayoutQuickMenuService,
		@IWebviewService webviewService: IWebviewService,
	) {
		super();

		this._register(layoutQuickMenuService.onDidOpen(session => {
			for (const webview of webviewService.webviews) {
				session.disposables.add(webview.onDidFocus(() => session.dismiss()));
			}

			session.disposables.add(webviewService.onDidChangeActiveWebview(activeWebview => {
				if (activeWebview) {
					session.dismiss();
				}
			}));
		}));
	}
}

registerWorkbenchContribution2(LayoutQuickMenuWebviewDismissContribution.ID, LayoutQuickMenuWebviewDismissContribution, WorkbenchPhase.AfterRestored);
