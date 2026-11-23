/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const ID_REGEX = /^[\w-]+\.[\w-]+$/;

export function sanitizeExtensionIds(ids: string[]): string[] {
    return ids.filter((id) => ID_REGEX.test(id));
}
