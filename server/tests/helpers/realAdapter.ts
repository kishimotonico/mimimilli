import { createRealAdapter, type RealAdapterOptions } from "../../src/adapters/real/index.ts";

const memoryDlsiteCache = { path: ":memory:" } as const;

/** テスト用 createRealAdapter。DLsiteキャッシュ未指定時は :memory: を使う。 */
export function createTestRealAdapter(
  options: Omit<RealAdapterOptions, "dlsiteCache"> &
    Partial<Pick<RealAdapterOptions, "dlsiteCache">>,
) {
  return createRealAdapter({
    ...options,
    dlsiteCache: options.dlsiteCache ?? memoryDlsiteCache,
  });
}
