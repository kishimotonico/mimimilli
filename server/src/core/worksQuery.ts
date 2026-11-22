// 作品一覧の純粋関数（ソート・統計・検索語の一致）。条件の評価は condition.ts。
import { toWorkListItem } from "@mimimilli/shared";
import type { CollectionStats, SortId, WorksPage, WorkSummary } from "@mimimilli/shared";
import {
  compareJapaneseSortKeys,
  compareUtf8Bytes,
  japaneseSortKey,
  stableRandomSortKey,
} from "./japaneseSortKey.ts";

/** 検索・フィルター・ソート中だけ使う内部ページ型。公開前にWorkListItemへ投影する。 */
export type WorkSummaryPage = Omit<WorksPage, "items"> & { items: WorkSummary[] };

export function toWorksPage(page: WorkSummaryPage, root: string): WorksPage {
  return {
    items: page.items.map((work) => toWorkListItem(work, root)),
    total: page.total,
    stats: page.stats,
  };
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

/** 作品検索の部分一致（タイトル・タグ・RJ/VJコード）の判定関数。q ごとの正規化は1回だけ行う。q が空なら全作品が一致 */
export function textMatcher(q: string): (work: WorkSummary) => boolean {
  if (!q) return () => true;
  const normalizedQuery = japaneseSortKey(q);
  const rjQuery = normalizeRjCode(q);
  return (work) => {
    if (japaneseSortKey(work.title).includes(normalizedQuery)) return true;
    if (work.tags.some((tag) => japaneseSortKey(tag).includes(normalizedQuery))) return true;
    return Boolean(
      rjQuery && work.dlsite.rjCode && normalizeRjCode(work.dlsite.rjCode).includes(rjQuery),
    );
  };
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
