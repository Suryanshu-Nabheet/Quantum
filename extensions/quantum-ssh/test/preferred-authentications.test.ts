/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from 'vitest';
import { getPreferredAuthentications } from '../src/authResolver';

describe('PreferredAuthentications', () => {
	it('uses the host-specific authentication order', () => {
		expect(getPreferredAuthentications({ PreferredAuthentications: 'password, publickey' })).toEqual(['password', 'publickey']);
	});

	it('ignores empty entries and uses OpenSSH defaults when unset', () => {
		expect(getPreferredAuthentications({ PreferredAuthentications: 'password, ,publickey,' })).toEqual(['password', 'publickey']);
		expect(getPreferredAuthentications({})).toEqual(['publickey', 'password', 'keyboard-interactive']);
	});
});
