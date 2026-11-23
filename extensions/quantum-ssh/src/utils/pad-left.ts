/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function padLeft(s: string, n: number, pad = ' ') {
    return pad.repeat(Math.max(0, n - s.length)) + s;
}
