// 作品検索（GET /api/works）の純粋関数。
// client/mocks/handlers/works.ts の searchWorks と同じセマンティクスを再現する。
import { AXIS_TAG_PREFIX } from "@mimikago/shared";
import type { WorksPage, WorksQuery, WorkSummary } from "@mimikago/shared";

const RECENT_VIEW_WINDOW_DAYS = 30;

/** WorkSummary[] にクエリ（検索・フィルタ・ソート・ページング）を適用する */
export function applyWorksQuery(works: WorkSummary[], params: WorksQuery): WorksPage {
  let results = [...works];

  results = filterByQuery(results, params.q);
  results = filterByTags(results, params.tags, params.tagOp);
  results = filterByAxis(results, params.axis, params.axisValue);
  results = filterByView(results, params.view);
  results = sortWorks(results, params.sort);

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
      work.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
  );
}

function filterByTags(works: WorkSummary[], tags: string[], tagOp: "AND" | "OR"): WorkSummary[] {
  if (tags.length === 0) return works;
  if (tagOp === "AND") {
    return works.filter((work) =>
      tags.every((tagFilter) =>
        work.tags.some((tag) => tag.toLowerCase().includes(tagFilter.toLowerCase()))
      )
    );
  }
  return works.filter((work) =>
    tags.some((tagFilter) =>
      work.tags.some((tag) => tag.toLowerCase().includes(tagFilter.toLowerCase()))
    )
  );
}

function filterByAxis(
  works: WorkSummary[],
  axis: WorksQuery["axis"],
  axisValue: WorksQuery["axisValue"]
): WorkSummary[] {
  if (!axis || !axisValue) return works;
  const prefix = AXIS_TAG_PREFIX[axis] ?? `${axis}/`;
  const fullValue = prefix + axisValue;
  return works.filter((work) => work.tags.some((tag) => tag === fullValue || tag === axisValue));
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

function sortWorks(works: WorkSummary[], sort: WorksQuery["sort"]): WorkSummary[] {
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
function paginate(works: WorkSummary[], page: number | undefined, limit: number | undefined): WorkSummary[] {
  if (page === undefined || limit === undefined) return works;
  const start = (page - 1) * limit;
  return works.slice(start, start + limit);
}
