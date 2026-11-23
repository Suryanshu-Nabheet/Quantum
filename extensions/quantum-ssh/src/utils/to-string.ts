/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isPrimitive, isRecord, isString } from '@zokugun/is-it-type';
import { inspect } from 'node:util';

export function toString(value: unknown): string {
    if (isPrimitive(value)) {
        return `${value}`;
    }
    else if (value instanceof Error) {
        return value.stack || value.message;
    }
    else if (isRecord(value)) {
        if (value.success === false && isString(value.message)) {
            return value.message;
        }
    }

    return inspect(value, { depth: null, compact: true, breakLength: Infinity });
}
