// 作品検索（GET /api/works）の純粋関数。
import { parseTag, tagEquals } from "@mimimilli/shared";
import type { SortId, WorksPage, WorksQuery, WorkSummary } from "@mimimilli/shared";
import {
  compareJapaneseSortKeys,
  compareUtf8Bytes,
  japaneseSortKey,
  stableRandomSortKey,
} from "./japaneseSortKey.ts";

const RECENT_VIEW_WINDOW_DAYS = 30;

/** 検索・フィルター・ソート中だけ使う内部ページ型。公開前にWorkListItemへ投影する。 */
export type WorkSummaryPage = Omit<WorksPage, "items"> & { items: WorkSummary[] };

/** WorkSummary[] にクエリ（検索・フィルタ・ソート・ページング）を適用する */
export function applyWorksQuery(works: WorkSummary[], params: WorksQuery): WorkSummaryPage {
  let results = [...works];

  results = filterByQuery(results, params.q);
  results = filterByTags(results, params.tags, params.tagOp);
  results = filterByAxis(results, params.axis, params.axisValue);
  results = filterByView(results, params.view);
  const seed = params.sort === "random" ? (params.seed ?? createRandomSeed()) : undefined;
  results = sortWorkSummaries(results, params.sort, seed);

  const total = results.length;
  const items = paginate(results, params.page, params.limit);

  return seed === undefined ? { items, total } : { items, total, seed };
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

function filterByQuery(works: WorkSummary[], q: string): WorkSummary[] {
  if (!q) return works;
  const normalizedQuery = japaneseSortKey(q);
  return works.filter(
    (work) =>
      japaneseSortKey(work.title).includes(normalizedQuery) ||
      work.tags.some((tag) => japaneseSortKey(tag).includes(normalizedQuery)),
  );
}

// タグ絞り込みは完全一致（ADR-0005 決定6。prefix は大文字小文字を無視、値は区別）
function filterByTags(works: WorkSummary[], tags: string[], tagOp: "AND" | "OR"): WorkSummary[] {
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

// 軸ドリル。"year" は addedAt の年、それ以外は prefix 軸としてタグの完全一致（ADR-0005）
function filterByAxis(
  works: WorkSummary[],
  axis: WorksQuery["axis"],
  axisValue: WorksQuery["axisValue"],
): WorkSummary[] {
  if (!axis || !axisValue) return works;
  if (axis === "year") {
    return works.filter((work) => work.addedAt.slice(0, 4) === axisValue);
  }
  return works.filter((work) =>
    work.tags.some((tag) => {
      const parsed = parseTag(tag);
      return parsed.kind === "annotated" && parsed.prefix === axis && parsed.value === axisValue;
    }),
  );
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
    case "unplayed":
      return works.filter((work) => !work.lastPlayedAt && work.status === "ok");
    case "missing":
      return works.filter((work) => work.status === "missing");
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

export function createRandomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]! & 0x7fffffff;
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
