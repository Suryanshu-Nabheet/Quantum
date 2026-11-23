/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from 'vitest';
import { filterEnvBySendEnv } from '../src/ssh/sendEnv';

describe('SendEnv filtering', () => {
	it('matches exact names and OpenSSH wildcards', () => {
		expect(filterEnvBySendEnv(['LANG', 'LC_*', 'APP_?'], {
			LANG: 'en_US.UTF-8', LC_ALL: 'C.UTF-8', APP_X: 'yes', APP_XY: 'no', OTHER: 'no'
		})).toEqual({ LANG: 'en_US.UTF-8', LC_ALL: 'C.UTF-8', APP_X: 'yes' });
	});

	it('applies negative patterns to previously configured patterns', () => {
		expect(filterEnvBySendEnv(['LC_*', '-LC_*', 'LANG'], {
			LC_ALL: 'C', LANG: 'en', OTHER: 'ignored'
		})).toEqual({ LANG: 'en' });
	});

	it('does not let negative patterns select values or invalid names inject shell syntax', () => {
		expect(filterEnvBySendEnv(['*', '-*'], {
			SAFE: 'value', 'BAD;touch /tmp/pwned': 'ignored'
		})).toEqual({});
	});
});
