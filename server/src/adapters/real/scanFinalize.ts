import { join } from "node:path";
import { getCategoryLogger } from "../../lib/logger.ts";
import { logDataIntegritySkips } from "./dataIntegrity.ts";
import { resolveWithin } from "./paths.ts";
import { gcThumbnailCache, type WorkCoverEntry } from "./thumbnailCache.ts";
import type { CatalogWorkRepository } from "./catalogWorkRepository.ts";
import type { WorkQueryRepository } from "./workQueryRepository.ts";

const scanLogger = getCategoryLogger("scan");

export const LAST_SCAN_TIME_KEY = "last_scan_time";

export async function finalizeScan(deps: {
  query: Pick<WorkQueryRepository, "listSummaries">;
  catalog: Pick<CatalogWorkRepository, "setScanState">;
  thumbnailCacheDir: string;
  throwIfCancelled?: () => void;
  integrityLogContext?: string;
}): Promise<void> {
  const {
    query,
    catalog,
    thumbnailCacheDir,
    throwIfCancelled,
    integrityLogContext = "scan-finalize",
  } = deps;
  const checkAbort = () => throwIfCancelled?.();

  checkAbort();
  const coverEntries: WorkCoverEntry[] = [];
  const { summaries, skipped } = query.listSummaries();
  logDataIntegritySkips(scanLogger, integrityLogContext, skipped);
  for (const work of summaries) {
    checkAbort();
    if (!work.cover) continue;
    const resolved = resolveWithin(work.physicalPath, join(work.physicalPath, work.cover.image));
    if (!resolved) continue;
    coverEntries.push({ workId: work.id, coverAbsolutePath: resolved });
  }
  checkAbort();
  const gcResult = await gcThumbnailCache(thumbnailCacheDir, coverEntries, {
    throwIfCancelled: checkAbort,
  });
  checkAbort();
  if (gcResult.deleted > 0 || gcResult.skippedWorks > 0) {
    scanLogger.warn("サムネイルキャッシュGCを実行しました", {
      deleted: gcResult.deleted,
      kept: gcResult.kept,
      skippedWorks: gcResult.skippedWorks,
    });
  }
  checkAbort();
  catalog.setScanState(LAST_SCAN_TIME_KEY, new Date().toISOString());
}
