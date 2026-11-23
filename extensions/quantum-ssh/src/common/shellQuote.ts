/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Quote a value as one literal token in a POSIX shell script. */
export function quotePosixShell(value: string): string {
	return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Quote a value as a literal in a PowerShell expression. */
export function quotePowerShell(value: string): string {
	return `'${value.replace(/'/g, `''`)}'`;
}
