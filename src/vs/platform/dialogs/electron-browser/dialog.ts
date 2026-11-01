/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { fromNow } from '../../../base/common/date.js';
import { isLinuxSnap } from '../../../base/common/platform.js';
import { localize } from '../../../nls.js';
import { IOSProperties } from '../../native/common/native.js';
import { IProductService } from '../../product/common/productService.js';
import { process } from '../../../base/parts/sandbox/electron-browser/globals.js';

export function createNativeAboutDialogDetails(productService: IProductService, osProps: IOSProperties): { title: string; details: string; detailsToCopy: string } {
	const quantumVersion = productService.quantumVersion ?? 'Unknown';
	let vscodeVersion = productService.vscodeVersion ?? productService.version;
	if (productService.vscodeCommit) {
		vscodeVersion = `${vscodeVersion} (${productService.vscodeCommit.substring(0, 8)})`;
	}
	let buildVersion = productService.version;
	if (productService.target) {
		buildVersion = `${buildVersion} (${productService.target} setup)`;
	} else if (productService.darwinUniversalAssetId) {
		buildVersion = `${buildVersion} (Universal)`;
	}
	const buildType = productService.quality === 'insider' ? 'Insider' : 'Stable';

	const getDetails = (useAgo: boolean): string => {
		return localize({ key: 'aboutDetail', comment: ['{0} is the product name; Electron, Chromium, Node.js, V8 and xterm.js are product names that need no translation'] },
			"{0}: {1}\nVS Code: {2}\nBuild: {3}\nBuild Type: {4}\nCommit: {5}\nDate: {6}\nElectron: {7}\nChromium: {8}\nNode.js: {9}\nV8: {10}\nxterm.js: {11}\nOS: {12}",
			productService.nameShort,
			quantumVersion,
			vscodeVersion,
			buildVersion,
			buildType,
			productService.commit || 'Unknown',
			productService.date ? `${productService.date}${useAgo ? ' (' + fromNow(new Date(productService.date), true) + ')' : ''}` : 'Unknown',
			process.versions['electron'],
			process.versions['chrome'],
			process.versions['node'],
			process.versions['v8'],
			productService.xtermVersion || 'Unknown',
			`${osProps.type} ${osProps.arch} ${osProps.release}${isLinuxSnap ? ' snap' : ''}`
		);
	};

	const details = getDetails(true);
	const detailsToCopy = getDetails(false);

	return {
		title: productService.nameLong,
		details: details,
		detailsToCopy: detailsToCopy
	};
}
