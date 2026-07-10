// 作品検索（GET /api/works）の純粋関数。
import { parseTag, tagEquals } from "@mimimilli/shared";
import type { SortId, WorksPage, WorksQuery, WorkSummary } from "@mimimilli/shared";

const RECENT_VIEW_WINDOW_DAYS = 30;

/** WorkSummary[] にクエリ（検索・フィルタ・ソート・ページング）を適用する */
export function applyWorksQuery(works: WorkSummary[], params: WorksQuery): WorksPage {
  let results = [...works];

  results = filterByQuery(results, params.q);
  results = filterByTags(results, params.tags, params.tagOp);
  results = filterByAxis(results, params.axis, params.axisValue);
  results = filterByView(results, params.view);
  results = sortWorkSummaries(results, params.sort);

  const total = results.length;
  const items = paginate(results, params.page, params.limit);

  return { items, total };
}

function filterByQuery(works: WorkSummary[], q: string): WorkSummary[] {
  if (!q) return works;
  const normalizedQuery = q.toLowerCase();
  return works.filter(
    (work) =>
      work.title.toLowerCase().includes(normalizedQuery) ||
      work.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery)),
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

export function sortWorkSummaries(works: WorkSummary[], sort: SortId): WorkSummary[] {
  const sorted = [...works];
  switch (sort) {
    case "title-asc":
      sorted.sort((a, b) => a.title.localeCompare(b.title, "ja"));
      break;
    case "title-desc":
      sorted.sort((a, b) => b.title.localeCompare(a.title, "ja"));
      break;
    case "added-asc":
      sorted.sort((a, b) => (a.addedAt < b.addedAt ? -1 : 1));
      break;
    case "added-desc":
      sorted.sort((a, b) => (a.addedAt > b.addedAt ? -1 : 1));
      break;
    case "duration-asc":
      sorted.sort((a, b) => a.totalDurationSec - b.totalDurationSec);
      break;
    case "duration-desc":
      sorted.sort((a, b) => b.totalDurationSec - a.totalDurationSec);
      break;
    case "last-played":
      sorted.sort((a, b) => {
        if (!a.lastPlayedAt && !b.lastPlayedAt) return 0;
        if (!a.lastPlayedAt) return 1;
        if (!b.lastPlayedAt) return -1;
        return a.lastPlayedAt > b.lastPlayedAt ? -1 : 1;
      });
      break;
    case "id-asc":
      sorted.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      break;
    case "random":
      shuffleInPlace(sorted);
      break;
    default:
      break;
  }
  return sorted;
}

/** Fisher-Yates シャッフル（破壊的） */
function shuffleInPlace<T>(items: T[]): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
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
