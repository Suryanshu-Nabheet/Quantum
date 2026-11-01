import "@testing-library/jest-dom";

// Node 22 exposes a global localStorage getter that is undefined unless
// --localstorage-file is set. Keep GUI tests on jsdom's storage and provide an
// in-memory fallback for opaque-origin test environments.
function createTestStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };
}

let testStorage: Storage;
try {
  testStorage = window.localStorage ?? createTestStorage();
} catch {
  testStorage = createTestStorage();
}
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: testStorage,
});
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: testStorage,
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  vi.resetAllMocks();
});

// Suppress uncaught ProseMirror errors in test environment
window.addEventListener("error", (event) => {
  if (
    event.error?.message?.includes("getClientRects") ||
    event.error?.message?.includes("prosemirror")
  ) {
    event.preventDefault();
    return false;
  }
});

window.addEventListener("unhandledrejection", (event) => {
  if (
    event.reason?.message?.includes("getClientRects") ||
    event.reason?.message?.includes("prosemirror")
  ) {
    event.preventDefault();
    return false;
  }
});

// https://github.com/vitest-dev/vitest/issues/821
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock getBoundingClientRect and getClientRects for ProseMirror
Object.defineProperty(Element.prototype, "getClientRects", {
  value: vi.fn(() => ({
    length: 1,
    0: { top: 0, bottom: 20, left: 0, right: 100, width: 100, height: 20 },
    item: () => ({
      top: 0,
      bottom: 20,
      left: 0,
      right: 100,
      width: 100,
      height: 20,
    }),
  })),
});

Object.defineProperty(Element.prototype, "getBoundingClientRect", {
  value: vi.fn(() => ({
    top: 0,
    bottom: 20,
    left: 0,
    right: 100,
    width: 100,
    height: 20,
  })),
});
