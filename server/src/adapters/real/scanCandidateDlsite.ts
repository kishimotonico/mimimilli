import type {
  DlsiteCachedCover,
  DlsiteProductSummary,
  ScanCandidateMissingWork,
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
}

export function createCandidateDlsiteSource(
  cache: DlsiteCache,
  resolve: DlsiteProductResolver,
): CandidateDlsiteSource {
  return { resolve, coverVersion: (key) => cache.coverVersionByKey(key) };
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
  const { title, coverUrl } = resolution.result.info;
  return { state: "fetched", title, cover: cachedCoverOf(coverUrl, source.coverVersion) };
}

/** カバーURLに対応するキャッシュ済みカバー。キャッシュに無い・許可外のURLはnull */
export function cachedCoverOf(
  coverUrl: string | null,
  coverVersion: (coverKey: string) => number | null,
): DlsiteCachedCover | null {
  if (!coverUrl) return null;
  let key: string;
  try {
    key = DlsiteCache.coverKey(normalizeDlsiteCoverUrl(coverUrl));
  } catch {
    return null;
  }
  const version = coverVersion(key);
  return version === null ? null : { key, version };
}

export function groupMissingWorksByRjCode(
  rows: ReadonlyArray<{ rjCode: string; workId: string; title: string }>,
): Map<string, ScanCandidateMissingWork[]> {
  const grouped = new Map<string, ScanCandidateMissingWork[]>();
  for (const { rjCode, workId, title } of rows) {
    const list = grouped.get(rjCode) ?? [];
    list.push({ workId, title });
    grouped.set(rjCode, list);
  }
  return grouped;
}
