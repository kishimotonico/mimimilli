import type { DlsiteFetchErrorKind, DlsiteState } from "@mimimilli/shared";
import type { DlsiteCache, DlsiteCacheResolution } from "./dlsiteCache.ts";

export type SidecarLinkageStatus = "none" | "applied" | "skipped";

export function sidecarLinkageStatus(status: DlsiteState["status"]): SidecarLinkageStatus {
  if (status === "applied" || status === "skipped") return status;
  return "none";
}

/** sidecar（mimimilli.json）へ書くDLsite状態。取得失敗の一時情報は含めない。 */
export function toSidecarDlsiteState(state: DlsiteState): DlsiteState {
  return {
    rjCode: state.rjCode,
    status: sidecarLinkageStatus(state.status),
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
 * sidecar正本とDLsiteキャッシュを合成し、catalog・APIが読む DlsiteState を組み立てる。
 * applied/skipped はsidecarの連携分類が優先し、none のときだけキャッシュの取得結果を反映する。
 */
export function projectDlsiteState(
  sidecar: DlsiteState,
  cacheResolution: DlsiteCacheResolution | null,
): DlsiteState {
  const linkage = sidecarLinkageStatus(sidecar.status);
  const base = {
    rjCode: sidecar.rjCode,
    appliedTags: sidecar.appliedTags,
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
  const rjCode = sidecar.rjCode;
  if (!rjCode || !cacheResolution) {
    return {
      ...base,
      status: "none",
      lastAttemptAt: null,
      error: null,
      errorKind: null,
    };
  }
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

export function resolveSidecarDlsiteProjection(
  sidecar: DlsiteState,
  cache: DlsiteCache | null | undefined,
): DlsiteState {
  if (!cache || !sidecar.rjCode) return projectDlsiteState(sidecar, null);
  return projectDlsiteState(sidecar, cache.resolve({ productCode: sidecar.rjCode }));
}

export function refreshCatalogDlsiteProjection(
  catalog: {
    getWorkMetaPath(id: string): string | null;
    setDlsiteState(workId: string, state: DlsiteState): void;
  },
  workId: string,
  sidecar: DlsiteState,
  cache: DlsiteCache | null | undefined,
): void {
  catalog.setDlsiteState(workId, resolveSidecarDlsiteProjection(sidecar, cache));
}
