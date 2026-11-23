/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/* eslint local/code-no-unexternalized-strings: off */

import { describe, expect, it } from 'vitest';
import { quotePowerShell, quotePosixShell } from '../src/common/shellQuote';

describe('remote shell literal quoting', () => {
	it('keeps POSIX shell substitutions and quotes literal', () => {
		expect(quotePosixShell("$(touch /tmp/pwned) \"quoted\" `id` 'single'")).toBe("'$(touch /tmp/pwned) \"quoted\" `id` '\\''single'\\'''");
	});

	it('keeps PowerShell substitutions and quotes literal', () => {
		expect(quotePowerShell(`$(New-Item /tmp/pwned) "quoted" 'single'`)).toBe(`'$(New-Item /tmp/pwned) "quoted" ''single'''`);
	});
});
