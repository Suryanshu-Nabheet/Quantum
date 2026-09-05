import { TextDecoder, TextEncoder } from "util";

import { beforeAll } from "vitest";

beforeAll(() => {
  // Node 20+ provides fetch/Request/Response globally; only polyfill encoding helpers.
  globalThis.TextEncoder = TextEncoder as typeof globalThis.TextEncoder;
  globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;
});
