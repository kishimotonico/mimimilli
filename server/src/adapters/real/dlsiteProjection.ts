import {
  hasRjCode,
  projectDlsiteState,
  type DlsiteFetchResult,
  type DlsiteState,
  type MetaDlsiteState,
} from "@mimimilli/shared";
import { readMetaSource } from "./meta.ts";
import type { DlsiteCache } from "./dlsiteCache.ts";

export { projectDlsiteState };

export function resolveMetaDlsiteProjection(
  metaDlsite: MetaDlsiteState,
  cache: DlsiteCache | null | undefined,
): DlsiteState {
  if (!cache || !hasRjCode(metaDlsite)) return projectDlsiteState(metaDlsite, null);
  return projectDlsiteState(metaDlsite, cache.resolve({ productCode: metaDlsite.rjCode }));
}

export function refreshCatalogDlsiteProjection(
  catalog: {
    getWorkMetaPath(id: string): string | null;
    setDlsiteState(workId: string, state: DlsiteState): void;
  },
  workId: string,
  metaDlsite: MetaDlsiteState,
  cache: DlsiteCache | null | undefined,
): void {
  catalog.setDlsiteState(workId, resolveMetaDlsiteProjection(metaDlsite, cache));
}

/** mimimilli.json を読み、cache と合成した DLsite 状態を catalog へ投影する。 */
export function refreshWorkDlsiteProjection(
  catalog: {
    getWorkMetaPath(id: string): string | null;
    setDlsiteState(workId: string, state: DlsiteState): void;
  },
  workId: string,
  cache: DlsiteCache | null | undefined,
): void {
  const metaPath = catalog.getWorkMetaPath(workId);
  if (!metaPath) return;
  refreshCatalogDlsiteProjection(catalog, workId, readMetaSource(metaPath).meta.dlsite, cache);
}

/** offline 由来の取得失敗は cache・catalog とも更新しない。 */
export function shouldRefreshDlsiteProjectionAfterFetch(result: DlsiteFetchResult): boolean {
  return result.ok || result.kind !== "offline";
}
