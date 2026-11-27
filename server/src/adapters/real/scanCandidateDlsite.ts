import {
  dlsiteProductSummaryOf,
  type DlsiteCachedCover,
  type DlsiteCoverLookup,
  type DlsiteProductSummary,
  type MissingWork,
} from "@mimimilli/shared";
import { normalizeDlsiteCoverUrl } from "./dlsite.ts";
import { DlsiteCache } from "./dlsiteCache.ts";
import {
  dlsiteFetchStateOfProductResolution,
  type DlsiteProductResolver,
} from "./dlsiteProductResolve.ts";

/** 候補のDLsite状態を導くために読むキャッシュ */
export interface CandidateDlsiteSource {
  resolve: DlsiteProductResolver;
  coverVersion(coverKey: string): number | null;
  coverFailed(coverKey: string): boolean;
}

export function createCandidateDlsiteSource(
  cache: DlsiteCache,
  resolve: DlsiteProductResolver,
): CandidateDlsiteSource {
  return {
    resolve,
    coverVersion: (key) => cache.coverVersionByKey(key),
    coverFailed: (key) => cache.hasCoverFailureByKey(key),
  };
}

/** キャッシュから導く取得状態。候補の表示と取得ジョブの終端が同じ規則を使う。待機中・取得中は含まない */
export function deriveDlsiteProductSummary(
  source: CandidateDlsiteSource,
  rjCode: string | null,
): DlsiteProductSummary {
  if (!rjCode) return { state: "none" };
  const resolution = source.resolve(rjCode);
  const state = dlsiteFetchStateOfProductResolution(resolution);
  if (state !== "fetched") return { state };
  if (resolution.kind !== "html" || !resolution.result.ok) return { state: "failed" };
  return dlsiteProductSummaryOf(resolution.result.info, (coverUrl) =>
    lookupCover(coverUrl, source),
  );
}

function coverKeyOf(coverUrl: string): string | null {
  try {
    return DlsiteCache.coverKey(normalizeDlsiteCoverUrl(coverUrl));
  } catch {
    return null;
  }
}

function lookupCover(coverUrl: string, source: CandidateDlsiteSource): DlsiteCoverLookup {
  const key = coverKeyOf(coverUrl);
  if (key === null) return { cached: null, failed: true };
  const version = source.coverVersion(key);
  if (version !== null) return { cached: { key, version }, failed: false };
  return { cached: null, failed: source.coverFailed(key) };
}

/** カバーURLに対応するキャッシュ済みカバー。キャッシュに無い・許可外のURLはnull */
export function cachedCoverOf(
  coverUrl: string | null,
  coverVersion: (coverKey: string) => number | null,
): DlsiteCachedCover | null {
  if (!coverUrl) return null;
  const key = coverKeyOf(coverUrl);
  if (key === null) return null;
  const version = coverVersion(key);
  return version === null ? null : { key, version };
}

export function groupMissingWorksByRjCode(
  rows: ReadonlyArray<{ rjCode: string } & MissingWork>,
): Map<string, MissingWork[]> {
  const grouped = new Map<string, MissingWork[]>();
  for (const { rjCode, ...work } of rows) {
    const list = grouped.get(rjCode) ?? [];
    list.push(work);
    grouped.set(rjCode, list);
  }
  return grouped;
}
