/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/* eslint local/code-no-unexternalized-strings: off */

import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { generateBashInstallScript, generatePowerShellInstallScript, type ServerInstallOptions } from '../src/serverSetup';

const options: ServerInstallOptions = {
	id: 'test-id', quality: 'stable', commit: 'abcdef0123456789', version: '1.2.3', release: '1',
	extensionIds: [], envVariables: [], sendEnvVars: { SAFE_VALUE: "$(touch /tmp/pwned) `id` 'quoted'" },
	useSocketPath: false, serverApplicationName: 'quantum-server', serverDataFolderName: '.quantum-server',
	serverDownloadUrlTemplate: 'https://example.invalid/${version}', serverValidation: 'strict',
	serverPlatform: 'linux', serverArch: 'x64', scriptPreventExit: false, localServerDownload: 'off'
};

describe('server install script inputs', () => {
	it('serializes SendEnv values as literal POSIX shell strings', () => {
		const script = generateBashInstallScript(options, process.cwd());
		expect(script).toContain("export SAFE_VALUE='$(touch /tmp/pwned) `id` '\\''quoted'\\'''");
		expect(script).not.toContain('export SAFE_VALUE="$(touch');
	});

	it('keeps custom install paths with spaces and shell syntax inside one Bash argument', () => {
		const script = generateBashInstallScript({ ...options, customInstallPath: "/tmp/Quantum Install/$(touch /tmp/pwned)" }, process.cwd());
		expect(script).toContain("SERVER_DATA_DIR='/tmp/Quantum Install/$(touch /tmp/pwned)'");
		expect(spawnSync('bash', ['-n'], { input: script, encoding: 'utf8' }).status).toBe(0);
	});

	it('treats Bash URL templates as data instead of shell source', () => {
		const script = generateBashInstallScript({
			...options,
			serverDownloadUrlTemplate: 'https://example.invalid/$(touch /tmp/pwned)/${version}'
		}, process.cwd());
		expect(script).toContain("SERVER_DOWNLOAD_URL_TEMPLATE='https://example.invalid/$(touch /tmp/pwned)/${version}'");
		expect(spawnSync('bash', ['-n'], { input: script, encoding: 'utf8' }).status).toBe(0);
	});

	it('serializes SendEnv values as literal PowerShell strings', () => {
		const script = generatePowerShellInstallScript(options, process.cwd());
		expect(script).toContain("$env:SAFE_VALUE='$(touch /tmp/pwned) `id` ''quoted'''");
		expect(script).not.toContain('$env:SAFE_VALUE="$(touch');
	});

	it('treats PowerShell URL templates and install paths as data', () => {
		const script = generatePowerShellInstallScript({
			...options,
			customInstallPath: "C:\\Quantum Install\\$(New-Item /tmp/pwned)",
			serverDownloadUrlTemplate: 'https://example.invalid/$(New-Item /tmp/pwned)/${version}'
		}, process.cwd());
		expect(script).toContain("$d='C:\\Quantum Install\\$(ni /tmp/pwned)'");
		expect(script).toContain("$u='https://example.invalid/$(ni /tmp/pwned)/1.2.3'");
	});
});
