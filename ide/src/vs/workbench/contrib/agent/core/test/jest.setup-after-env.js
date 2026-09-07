import { TextDecoder, TextEncoder } from "util";

import { jest } from "@jest/globals";
import fetch, { Request, Response } from "node-fetch";

if (process.env.DEBUG === "jest") {
  jest.setTimeout(5 * 60 * 1000);
}

const globalThis = global;

globalThis.jest = jest;

// https://github.com/mswjs/msw/issues/1576#issuecomment-1482643055
globalThis.fetch = fetch;
globalThis.Request = Request;
globalThis.Response = Response;
globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder;

import fs from "fs";

const clearTestDirectory = () => {
  const globalDir = process.env.AGENT_GLOBAL_DIR;
  if (!globalDir || !fs.existsSync(globalDir)) {
    return;
  }
  try {
    fs.rmSync(globalDir, { recursive: true, force: true, maxRetries: 3 });
  } catch {
    // Indexing tests may still hold sqlite handles briefly; global-setup wipes on next run.
  }
};

globalThis.afterAll(clearTestDirectory);
