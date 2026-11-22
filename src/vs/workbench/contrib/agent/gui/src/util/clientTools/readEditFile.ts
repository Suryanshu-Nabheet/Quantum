/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ClientToolExtras } from "./callClientTool";

export async function readEditFile(filepath: string, extras: ClientToolExtras) {
  const contents = await extras.hostBridge.ide.readFile(filepath);
  const preview = extras.editPreview;
  if (preview && (preview.filepath !== filepath || preview.contents !== contents)) {
    throw new Error("The file changed after the edit was previewed. Review the updated file before editing it.");
  }
  return contents;
}
