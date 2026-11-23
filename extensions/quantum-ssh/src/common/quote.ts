/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Platform } from './platform';

export function quote(s: string, platform: Platform): string {
    if (platform === Platform.Windows) {
        // For Powershell
        return `"${s}"`;
    }
    return `'${s.replace(/'/g, `'\\''`)}'`;
}
