/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { threadId, workerData } from "node:worker_threads";

const sharedLock = workerData?.agentStateLock;
const stateLock = sharedLock instanceof SharedArrayBuffer
  ? new Int32Array(sharedLock)
  : undefined;

/** Serialize synchronous disk mutations across windows in the same IDE process. */
export function withAgentStateLock<T>(operation: () => T): T {
  if (!stateLock || Atomics.load(stateLock, 0) === threadId) {
    return operation();
  }

  for (;;) {
    const owner = Atomics.compareExchange(stateLock, 0, 0, threadId);
    if (owner === 0) {
      break;
    }
    Atomics.wait(stateLock, 0, owner);
  }

  try {
    return operation();
  } finally {
    Atomics.store(stateLock, 0, 0);
    Atomics.notify(stateLock, 0, 1);
  }
}

export function writeAtomically(filepath: string, data: string) {
  const temporary = `${filepath}.${randomUUID()}.tmp`;
  const fd = fs.openSync(temporary, "wx", 0o600);
  try {
    try {
      fs.writeFileSync(fd, data);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(temporary, filepath);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }
}
