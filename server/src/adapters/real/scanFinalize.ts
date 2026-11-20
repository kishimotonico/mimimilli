import type { ScanOptions } from "../../adapter/index.ts";
import { getCategoryLogger } from "../../lib/logger.ts";
import {
  buildCoverSnapshot,
  countCoverSnapshotGapsByReason,
  isCoverSnapshotComplete,
} from "./coverSnapshot.ts";
import { gcThumbnailCache } from "./thumbnailCache.ts";
import type { CatalogWorkRepository } from "./catalogWorkRepository.ts";
import type { ScanExecutionResult } from "../../adapter/index.ts";
import type { ScannerAbortHooks } from "./scanWalk.ts";
import type { Scanner } from "./scanner.ts";
import type { WorkQueryRepository } from "./workQueryRepository.ts";

const scanLogger = getCategoryLogger("scan");

export const LAST_SCAN_TIME_KEY = "last_scan_time";

export async function finalizeScan(deps: {
  query: Pick<WorkQueryRepository, "listSummaries">;
  catalog: Pick<CatalogWorkRepository, "setScanState">;
  thumbnailCacheDir: string;
  throwIfCancelled?: () => void;
}): Promise<void> {
  const { query, catalog, thumbnailCacheDir, throwIfCancelled } = deps;
  const checkAbort = () => throwIfCancelled?.();

  checkAbort();
  const result = query.listSummaries();
  const snapshot = await buildCoverSnapshot(result, { throwIfCancelled: checkAbort });
  checkAbort();
  if (isCoverSnapshotComplete(snapshot)) {
    const gcResult = await gcThumbnailCache(thumbnailCacheDir, snapshot.validNames, {
      throwIfCancelled: checkAbort,
    });
    if (gcResult.deleted > 0) {
      scanLogger.warn("サムネイルキャッシュGCを実行しました", {
        deleted: gcResult.deleted,
        kept: gcResult.kept,
      });
    }
  } else {
    scanLogger.warn("スナップショットが不完全なためサムネイルキャッシュGCをスキップしました", {
      workCount: snapshot.workCount,
      gaps: countCoverSnapshotGapsByReason(snapshot.gaps),
      cacheDir: thumbnailCacheDir,
    });
  }
  checkAbort();
  catalog.setScanState(LAST_SCAN_TIME_KEY, new Date().toISOString());
}

/** スキャン本体と完了後処理（サムネイルGC・last_scan_time記録）を行う、全DB種別共通の経路。 */
export async function scanAndFinalize(deps: {
  scanner: Pick<Scanner, "scan">;
  query: Pick<WorkQueryRepository, "listSummaries">;
  catalog: Pick<CatalogWorkRepository, "setScanState">;
  thumbnailCacheDir: string;
  root: string;
  options?: ScanOptions;
  abortHooks?: ScannerAbortHooks;
  throwIfCancelled: () => void;
}): Promise<ScanExecutionResult> {
  const { scanner, query, catalog, thumbnailCacheDir, throwIfCancelled } = deps;
  const execution = await scanner.scan(deps.root, deps.options, deps.abortHooks);
  await finalizeScan({ query, catalog, thumbnailCacheDir, throwIfCancelled });
  return execution;
}
