// 作品検索（GET /api/works）の純粋関数。
import {
  tagEquals,
  toWorkListItem,
  RECENT_VIEW_WINDOW_DAYS,
  createRandomSeed,
} from "@mimimilli/shared";
import type {
  CollectionStats,
  NormalizedTag,
  SortId,
  WorksPage,
  WorksQuery,
  WorkSummary,
} from "@mimimilli/shared";
import {
  compareJapaneseSortKeys,
  compareUtf8Bytes,
  japaneseSortKey,
  stableRandomSortKey,
} from "./japaneseSortKey.ts";

/** 検索・フィルター・ソート中だけ使う内部ページ型。公開前にWorkListItemへ投影する。 */
export type WorkSummaryPage = Omit<WorksPage, "items"> & { items: WorkSummary[] };

export function toWorksPage(page: WorkSummaryPage, root: string): WorksPage {
  const items = page.items.map((work) => toWorkListItem(work, root));
  return page.seed === undefined
    ? { items, total: page.total, stats: page.stats }
    : { items, total: page.total, stats: page.stats, seed: page.seed };
}

/** フィルター後・ページング前の集合からコレクション統計を求める。
 *  totalDurationSec が未知（null）の作品は合計から除外する。 */
export function computeCollectionStats(works: WorkSummary[]): CollectionStats {
  let trackCount = 0;
  let durationSec = 0;
  for (const work of works) {
    trackCount += work.trackCount;
    if (work.totalDurationSec !== null) durationSec += work.totalDurationSec;
  }
  return { trackCount, durationSec };
}

/** WorkSummary[] にクエリ（検索・フィルタ・ソート・ページング）を適用する */
export function applyWorksQuery(works: WorkSummary[], params: WorksQuery): WorkSummaryPage {
  let results = [...works];

  const { tags, yearValue } = params.tags;
  results = filterByIds(results, params.ids);
  results = filterByQuery(results, params.q);
  results = filterByTags(results, tags, params.tagOp);
  results = filterByYear(results, yearValue);
  results = filterByView(results, params.view);
  const seed = params.sort === "random" ? (params.seed ?? createRandomSeed()) : undefined;
  results = sortWorkSummaries(results, params.sort, seed);

  const total = results.length;
  const stats = computeCollectionStats(results);
  const items = paginate(results, params.page, params.limit);

  return seed === undefined ? { items, total, stats } : { items, total, stats, seed };
}

/**
 * totalDurationSec（null許容）の比較。未知（null）は direction に関わらず必ず末尾へ寄せる。
 * direction=1で昇順、-1で降順として扱う。
 */
function compareDuration(a: WorkSummary, b: WorkSummary, direction: 1 | -1): number {
  if (a.totalDurationSec === null && b.totalDurationSec === null) return 0;
  if (a.totalDurationSec === null) return 1;
  if (b.totalDurationSec === null) return -1;
  return (a.totalDurationSec - b.totalDurationSec) * direction;
}

// RJ/VJコード比較用の正規化。大文字小文字と "RJ"/"VJ" 接頭辞の有無を無視して比較する
// （DLsite商品コードはRJ=同人、VJ=商業/美少女ゲームの2種類。shared/dlsite.tsのrjCode
// フィールドは両方を同じ形式 `^(RJ|VJ)\d{6,8}$` で保持する）。
// real側のSQL実装（workQueryRepository queryWorks）と同じ正規化仕様に揃える。
export function normalizeRjCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/^(RJ|VJ)/, "");
}

function filterByIds(works: WorkSummary[], ids: string[] | undefined): WorkSummary[] {
  if (ids === undefined) return works;
  const idSet = new Set(ids);
  return works.filter((work) => idSet.has(work.id));
}

function filterByQuery(works: WorkSummary[], q: string): WorkSummary[] {
  if (!q) return works;
  const normalizedQuery = japaneseSortKey(q);
  const rjQuery = normalizeRjCode(q);
  return works.filter((work) => {
    if (japaneseSortKey(work.title).includes(normalizedQuery)) return true;
    if (work.tags.some((tag) => japaneseSortKey(tag).includes(normalizedQuery))) return true;
    if (rjQuery && work.dlsite.rjCode && normalizeRjCode(work.dlsite.rjCode).includes(rjQuery)) {
      return true;
    }
    return false;
  });
}

// タグ絞り込みは完全一致（ADR-0005 決定6。prefix は大文字小文字を無視、値は区別）
export function filterByTags(
  works: WorkSummary[],
  tags: NormalizedTag[],
  tagOp: "AND" | "OR",
): WorkSummary[] {
  if (tags.length === 0) return works;
  if (tagOp === "AND") {
    return works.filter((work) =>
      tags.every((tagFilter) => work.tags.some((tag) => tagEquals(tag, tagFilter))),
    );
  }
  return works.filter((work) =>
    tags.some((tagFilter) => work.tags.some((tag) => tagEquals(tag, tagFilter))),
  );
}

/** 組み込み軸 year（addedAt の年）での絞り込み。実タグとの衝突を避けるため擬似タグ経由でのみ渡る */
export function filterByYear(works: WorkSummary[], yearValue: string | null): WorkSummary[] {
  if (yearValue === null) return works;
  return works.filter((work) => work.addedAt.slice(0, 4) === yearValue);
}

function filterByView(works: WorkSummary[], view: WorksQuery["view"]): WorkSummary[] {
  switch (view) {
    case "recent":
      return works.filter((work) => work.lastPlayedAt != null);
    case "added": {
      const cutoff = new Date(Date.now() - RECENT_VIEW_WINDOW_DAYS * 86400000).toISOString();
      return works.filter((work) => work.addedAt >= cutoff);
    }
    case "fav":
      return works.filter((work) => work.bookmarked);
    case "error":
      return works.filter((work) => work.status !== "ok");
    case "all":
    case undefined:
      return works;
    default:
      return works;
  }
}

export function sortWorkSummaries(
  works: WorkSummary[],
  sort: SortId,
  seed?: number,
): WorkSummary[] {
  const sorted = [...works];
  const byId = (a: WorkSummary, b: WorkSummary): number => compareUtf8Bytes(a.id, b.id);
  switch (sort) {
    case "title-asc":
      sorted.sort((a, b) => compareJapaneseSortKeys(a.title, b.title) || byId(a, b));
      break;
    case "title-desc":
      sorted.sort((a, b) => compareJapaneseSortKeys(b.title, a.title) || byId(a, b));
      break;
    case "added-asc":
      sorted.sort((a, b) => compareStrings(a.addedAt, b.addedAt) || byId(a, b));
      break;
    case "added-desc":
      sorted.sort((a, b) => compareStrings(b.addedAt, a.addedAt) || byId(a, b));
      break;
    // totalDurationSec が未知（null）の作品は昇順・降順どちらでも末尾に寄せる。
    case "duration-asc":
      sorted.sort((a, b) => compareDuration(a, b, 1) || byId(a, b));
      break;
    case "duration-desc":
      sorted.sort((a, b) => compareDuration(a, b, -1) || byId(a, b));
      break;
    case "last-played":
      sorted.sort((a, b) => {
        if (!a.lastPlayedAt && !b.lastPlayedAt) return byId(a, b);
        if (!a.lastPlayedAt) return 1;
        if (!b.lastPlayedAt) return -1;
        return compareStrings(b.lastPlayedAt, a.lastPlayedAt) || byId(a, b);
      });
      break;
    case "id-asc":
      sorted.sort(byId);
      break;
    case "random":
      if (seed === undefined) throw new Error("randomソートにはseedが必要です");
      sorted.sort(
        (a, b) =>
          compareStrings(stableRandomSortKey(seed, a.id), stableRandomSortKey(seed, b.id)) ||
          byId(a, b),
      );
      break;
    default:
      break;
  }
  return sorted;
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** page/limit が両方指定されているときのみ slice する */
function paginate(
  works: WorkSummary[],
  page: number | undefined,
  limit: number | undefined,
): WorkSummary[] {
  if (page === undefined || limit === undefined) return works;
  const start = (page - 1) * limit;
  return works.slice(start, start + limit);
}
