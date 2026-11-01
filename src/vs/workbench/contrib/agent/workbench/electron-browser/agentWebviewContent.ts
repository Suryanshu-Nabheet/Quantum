/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../../base/common/uri.js';
import { asWebviewUri, webviewGenericCspSource } from '../../../webview/common/webview.js';

export interface IAgentWebviewContentOptions {
	readonly guiRoot: URI;
	readonly nonce: string;
	readonly title: 'Quantum Agent' | 'Quantum Settings';
	readonly workspacePaths: readonly string[];
	readonly page: 'sidebar' | 'settings';
	readonly initialRoute?: string;
}

function serializeScriptValue(value: string | readonly string[]): string {
	return JSON.stringify(value)
		.replace(/</g, '\\u003c')
		.replace(/>/g, '\\u003e')
		.replace(/&/g, '\\u0026')
		.replace(/\u2028/g, '\\u2028')
		.replace(/\u2029/g, '\\u2029');
}

export function createAgentWebviewContent(options: IAgentWebviewContentOptions): string {
	const scriptUri = asWebviewUri(URI.joinPath(options.guiRoot, 'assets', 'index.js'));
	const styleUri = asWebviewUri(URI.joinPath(options.guiRoot, 'assets', 'index.css'));
	const mediaBaseUrl = `${asWebviewUri(options.guiRoot).toString()}/`;
	const bodyClass = options.page === 'settings' ? 'full-screen' : 'sidebar';
	const pageGlobals = options.page === 'settings'
		? `window.isFullScreen = true; window.initialRoute = ${serializeScriptValue(options.initialRoute ?? '/config')};`
		: '';

	return `<!doctype html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${options.nonce}' ${webviewGenericCspSource} 'unsafe-eval'; style-src 'unsafe-inline' ${webviewGenericCspSource}; img-src ${webviewGenericCspSource} https: data: blob:; font-src ${webviewGenericCspSource} data:; connect-src https:;">
	<link rel="stylesheet" href="${styleUri}">
	<title>${options.title}</title>
</head>
<body class="${bodyClass}">
	<div id="root"></div>
	<script nonce="${options.nonce}">
		const vscode = acquireVsCodeApi();
		window.vscMediaUrl = ${serializeScriptValue(mediaBaseUrl)};
		window.workspacePaths = ${serializeScriptValue(options.workspacePaths)};
		window.workbenchHoverDelay = 500;
		${pageGlobals}
	</script>
	<script type="module" nonce="${options.nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
