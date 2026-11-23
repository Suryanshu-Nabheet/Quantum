/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'node:fs';
import * as path from 'path';
import * as vscode from 'vscode';

export async function getProductJson(): Promise<Record<string, unknown>> {
    return JSON.parse(await fs.promises.readFile(path.join(vscode.env.appRoot, 'product.json'), 'utf8'));
}
