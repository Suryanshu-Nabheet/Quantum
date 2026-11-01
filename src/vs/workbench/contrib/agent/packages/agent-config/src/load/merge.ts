import type { RequestOptions } from "../schemas/models.js";

export function mergeRequestOptions(
  base: RequestOptions | undefined,
  global: RequestOptions | undefined,
): RequestOptions | undefined {
  if (!base && !global) {
    return undefined;
  }
  if (!base) {
    return global;
  }
  if (!global) {
    return base;
  }

  const headers = {
    ...global.headers,
    ...base.headers,
  };

  return {
    ...global,
    ...base,
    headers: Object.keys(headers).length === 0 ? undefined : headers,
  };
}
