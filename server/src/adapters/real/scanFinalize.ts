import { getCategoryLogger } from "../../lib/logger.ts";
import {
  buildCoverSnapshot,
  countCoverSnapshotGapsByReason,
  isCoverSnapshotComplete,
} from "./coverSnapshot.ts";
import { logDataIntegritySkips } from "./dataIntegrity.ts";
import { gcThumbnailCache } from "./thumbnailCache.ts";
import type { CatalogWorkRepository } from "./catalogWorkRepository.ts";
import type { WorkQueryRepository } from "./workQueryRepository.ts";

const scanLogger = getCategoryLogger("scan");

export const LAST_SCAN_TIME_KEY = "last_scan_time";
/** 直近の完了スキャンが対象にしたルートフォルダー。GET /settings の lastScanRootFolder に対応する */
export const LAST_SCAN_ROOT_KEY = "last_scan_root_folder";

export async function finalizeScan(deps: {
  query: Pick<WorkQueryRepository, "listSummaries">;
  catalog: Pick<CatalogWorkRepository, "setScanState">;
  thumbnailCacheDir: string;
  root: string;
  throwIfCancelled?: () => void;
  integrityLogContext?: string;
}): Promise<void> {
  const {
    query,
    catalog,
    thumbnailCacheDir,
    root,
    throwIfCancelled,
    integrityLogContext = "scan-finalize",
  } = deps;
  const checkAbort = () => throwIfCancelled?.();

  checkAbort();
  const result = query.listSummaries();
  logDataIntegritySkips(scanLogger, integrityLogContext, result.skipped);
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
  catalog.setScanState(LAST_SCAN_ROOT_KEY, root);
}
