import {
  hasRjCode,
  type DlsiteFetchErrorKind,
  type DlsiteFetchResult,
  type DlsiteState,
} from "@mimimilli/shared";
import { readMetaSource } from "./meta.ts";
import type { DlsiteCache, DlsiteCacheResolution } from "./dlsiteCache.ts";

export type MetaLinkageStatus = "none" | "applied" | "skipped";

export function metaLinkageStatus(status: DlsiteState["status"]): MetaLinkageStatus {
  if (status === "applied" || status === "skipped") return status;
  return "none";
}

/** mimimilli.jsonへ書くDLsite状態。取得失敗の一時情報は含めない。 */
export function toMetaDlsiteState(state: DlsiteState): DlsiteState {
  return {
    rjCode: state.rjCode,
    status: metaLinkageStatus(state.status),
    appliedTags: state.appliedTags,
    lastAttemptAt: null,
    error: null,
    errorKind: null,
  };
}

function isoFromEpochMs(epochMs: number): string {
  return new Date(epochMs).toISOString();
}

function failureMessage(rjCode: string, outcome: "not_found" | "error"): string {
  return outcome === "not_found"
    ? `DLsite作品が見つかりません（${rjCode}）`
    : `DLsite取得に失敗しました（${rjCode}）`;
}

function parseErrorMessage(rjCode: string): string {
  return `DLsiteのHTMLを解析できませんでした（${rjCode}）`;
}

function projectedFetchFailure(
  base: Pick<DlsiteState, "rjCode" | "appliedTags">,
  status: "not_found" | "error",
  errorKind: DlsiteFetchErrorKind,
  message: string,
  lastAttemptAt: string,
): DlsiteState {
  return {
    ...base,
    status,
    lastAttemptAt,
    error: message,
    errorKind,
  };
}

/**
 * mimimilli.json正本とDLsiteキャッシュを合成し、catalog・APIが読む DlsiteState を組み立てる。
 * applied/skipped はmimimilli.jsonの連携分類が優先し、none のときだけキャッシュの取得結果を反映する。
 */
export function projectDlsiteState(
  metaDlsite: DlsiteState,
  cacheResolution: DlsiteCacheResolution | null,
): DlsiteState {
  const linkage = metaLinkageStatus(metaDlsite.status);
  const base = {
    rjCode: metaDlsite.rjCode,
    appliedTags: metaDlsite.appliedTags,
  };
  if (linkage === "applied" || linkage === "skipped") {
    return {
      ...base,
      status: linkage,
      lastAttemptAt: null,
      error: null,
      errorKind: null,
    };
  }
  if (!hasRjCode(metaDlsite) || !cacheResolution) {
    return {
      ...base,
      status: "none",
      lastAttemptAt: null,
      error: null,
      errorKind: null,
    };
  }
  const rjCode = metaDlsite.rjCode;
  if (cacheResolution.kind === "failure") {
    const status = cacheResolution.outcome === "not_found" ? "not_found" : "error";
    const errorKind = cacheResolution.outcome === "not_found" ? "not_found" : "error";
    return projectedFetchFailure(
      base,
      status,
      errorKind,
      failureMessage(rjCode, cacheResolution.outcome),
      isoFromEpochMs(cacheResolution.attemptedAt),
    );
  }
  if (cacheResolution.kind === "html" && cacheResolution.outcome === "parse_error") {
    return projectedFetchFailure(
      base,
      "error",
      "parse_error",
      parseErrorMessage(rjCode),
      isoFromEpochMs(cacheResolution.fetchedAt),
    );
  }
  return {
    ...base,
    status: "none",
    lastAttemptAt: null,
    error: null,
    errorKind: null,
  };
}

export function resolveMetaDlsiteProjection(
  metaDlsite: DlsiteState,
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
  metaDlsite: DlsiteState,
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
