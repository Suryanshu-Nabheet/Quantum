/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Convert an OpenSSH SendEnv glob to a regular expression. */
function globToRegex(pattern: string): RegExp {
	const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
	return new RegExp(`^${escaped.replace(/\*/g, '.*').replace(/\?/g, '.')}$`);
}

/**
 * Apply OpenSSH SendEnv patterns in order. A leading `-` removes earlier
 * patterns matched by that glob; only valid environment names are forwarded.
 */
export function filterEnvBySendEnv(
	sendEnvPatterns: string[],
	environment: NodeJS.ProcessEnv = process.env
): Record<string, string> {
	const patterns: string[] = [];
	for (const rawPattern of sendEnvPatterns) {
		const pattern = rawPattern.trim();
		if (!pattern) {
			continue;
		}
		if (pattern.startsWith('-')) {
			const removalPattern = globToRegex(pattern.slice(1));
			for (let index = patterns.length - 1; index >= 0; index--) {
				if (removalPattern.test(patterns[index])) {
					patterns.splice(index, 1);
				}
			}
		} else {
			patterns.push(pattern);
		}
	}

	const result: Record<string, string> = {};
	const matchers = patterns.map(globToRegex);
	for (const [key, value] of Object.entries(environment)) {
		if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && value !== undefined && matchers.some(matcher => matcher.test(key))) {
			result[key] = value;
		}
	}
	return result;
}
