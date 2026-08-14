import { createRealAdapter, type RealAdapterOptions } from "../../src/adapters/real/index.ts";
import { runFileScanInWorker } from "../../src/adapters/real/scanRunner.ts";

const memoryDlsiteCache = { path: ":memory:" } as const;

export interface ScanWorkerTestHooks {
  scanWorkerTestGate?: SharedArrayBuffer;
  scanWorkerTestGateStage?: "before-scan" | "before-finalize";
  onScanWorkerTestGateReady?: () => void;
}

type TestRealAdapterOptions = Omit<RealAdapterOptions, "dlsiteCache"> &
  Partial<Pick<RealAdapterOptions, "dlsiteCache">> &
  ScanWorkerTestHooks;

/** テスト用 createRealAdapter。DLsiteキャッシュ未指定時は :memory: を使う。 */
export function createTestRealAdapter(options: TestRealAdapterOptions) {
  const {
    scanWorkerTestGate,
    scanWorkerTestGateStage,
    onScanWorkerTestGateReady,
    ...adapterOptions
  } = options;
  const hasScanWorkerTestHooks =
    scanWorkerTestGate !== undefined ||
    scanWorkerTestGateStage !== undefined ||
    onScanWorkerTestGateReady !== undefined;
  return createRealAdapter(
    {
      ...adapterOptions,
      dlsiteCache: adapterOptions.dlsiteCache ?? memoryDlsiteCache,
    },
    hasScanWorkerTestHooks
      ? {
          runFileScanInWorker: (database, root, thumbnailCacheDir, dlsiteCache, scanOptions) =>
            runFileScanInWorker(
              database,
              root,
              thumbnailCacheDir,
              dlsiteCache,
              scanOptions,
              scanWorkerTestGate,
              scanWorkerTestGateStage ?? "before-scan",
              onScanWorkerTestGateReady,
            ),
        }
      : undefined,
  );
}
