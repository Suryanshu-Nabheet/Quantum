import AutocompleteLruCache from "./AutocompleteLruCache";

jest.mock("async-mutex", () => {
  const acquire = jest.fn().mockResolvedValue(jest.fn());
  return {
    Mutex: jest.fn().mockImplementation(() => ({ acquire })),
  };
});

describe("AutocompleteLruCache", () => {
  let cache: AutocompleteLruCache;

  beforeEach(async () => {
    (AutocompleteLruCache as any).instancePromise = undefined;
    (AutocompleteLruCache as any).capacity = 3;
    cache = await AutocompleteLruCache.get();
  });

  afterEach(async () => {
    await cache.close();
  });

  it("returns undefined for cache miss", async () => {
    expect(await cache.get("unknown")).toBeUndefined();
  });

  it("stores and retrieves completions by exact key", async () => {
    await cache.put("request-key", "42;");
    expect(await cache.get("request-key")).toBe("42;");
  });

  it("does not reuse prefix matches for opaque keys", async () => {
    await cache.put("request-key", "42;");
    expect(await cache.get("request-key:typed-more")).toBeUndefined();
  });

  it("evicts oldest entry when capacity is exceeded", async () => {
    await cache.put("a", "1");
    await cache.put("b", "2");
    await cache.put("c", "3");
    await cache.put("d", "4");

    expect(await cache.get("a")).toBeUndefined();
    expect(await cache.get("d")).toBe("4");
  });

  it("clears cache on close", async () => {
    await cache.put("key", "value");
    await cache.close();
    const reopened = await AutocompleteLruCache.get();
    expect(await reopened.get("key")).toBeUndefined();
    await reopened.close();
  });
});
