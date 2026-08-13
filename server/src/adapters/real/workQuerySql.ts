import type { NormalizedTag } from "@mimimilli/shared";
import type { DlsiteNotificationKind, SmartFolderRule, WorksQuery } from "@mimimilli/shared";
import { RECENT_VIEW_WINDOW_DAYS } from "@mimimilli/shared";
import { normalizeRjCode } from "../../core/worksQuery.ts";

/** SQLite の IN 句パラメータ上限を避けるため、配列を一定件数ごとに分割する */
export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export const SQLITE_IN_CHUNK_SIZE = 900;

export function inClausePlaceholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

export function worksOrderSql(
  sort: WorksQuery["sort"],
  seed: number | undefined,
  bindings: number[],
): string {
  const idTieBreaker = "works.id COLLATE BINARY ASC";
  switch (sort) {
    case "title-asc":
      return `works.title_sort_key COLLATE BINARY ASC, ${idTieBreaker}`;
    case "title-desc":
      return `works.title_sort_key COLLATE BINARY DESC, ${idTieBreaker}`;
    case "added-asc":
      return `work_states.added_at ASC, ${idTieBreaker}`;
    case "added-desc":
      return `work_states.added_at DESC, ${idTieBreaker}`;
    case "duration-asc":
      return `works.total_duration_sec IS NULL ASC, works.total_duration_sec ASC, ${idTieBreaker}`;
    case "duration-desc":
      return `works.total_duration_sec IS NULL ASC, works.total_duration_sec DESC, ${idTieBreaker}`;
    case "last-played":
      return `work_states.last_played_at IS NULL ASC, work_states.last_played_at DESC, ${idTieBreaker}`;
    case "id-asc":
      return idTieBreaker;
    case "random": {
      if (seed === undefined) throw new Error("randomソートにはseedが必要です");
      bindings.push(seed, seed);
      const hexId = "hex(works.id)";
      const rotated =
        `CASE WHEN length(${hexId}) = 0 THEN '' ELSE ` +
        `substr(${hexId}, (? % length(${hexId})) + 1) || ` +
        `substr(${hexId}, 1, ? % length(${hexId})) END`;
      return `${rotated} COLLATE BINARY ASC, ${idTieBreaker}`;
    }
  }
}

function rjCodeNormalizedSql(alias: string): string {
  return (
    `CASE WHEN substr(UPPER(json_extract(${alias}.state_json, '$.rjCode')), 1, 2) IN ('RJ', 'VJ') ` +
    `THEN substr(UPPER(json_extract(${alias}.state_json, '$.rjCode')), 3) ` +
    `ELSE UPPER(json_extract(${alias}.state_json, '$.rjCode')) END`
  );
}

export function textSearchCondition(
  searchKey: string,
  rawQuery: string,
): { conditions: string[]; bindings: string[] } {
  const rjKey = normalizeRjCode(rawQuery);
  const rjCondition = rjKey
    ? ` OR EXISTS (
          SELECT 1
          FROM main.work_dlsite AS query_dlsite
          WHERE query_dlsite.work_id = works.id
            AND instr(${rjCodeNormalizedSql("query_dlsite")}, ?) > 0
        )`
    : "";
  const bindings = [searchKey, searchKey];
  if (rjKey) bindings.push(rjKey);
  return {
    conditions: [
      `(
      instr(works.title_sort_key, ?) > 0 OR EXISTS (
        SELECT 1
        FROM main.work_tags AS query_work_tags
        INNER JOIN main.tags AS query_tags ON query_tags.id = query_work_tags.tag_id
        WHERE query_work_tags.work_id = works.id
          AND instr(query_tags.search_key, ?) > 0
      )${rjCondition}
    )`,
    ],
    bindings,
  };
}

export function tagAxisConditions(
  tags: NormalizedTag[],
  tagOp: "AND" | "OR",
  yearValue: string | null,
): { conditions: string[]; bindings: Array<string | number> } {
  const conditions: string[] = [];
  const bindings: Array<string | number> = [];

  if (tags.length > 0) {
    if (tagOp === "AND") {
      for (const tag of tags) {
        conditions.push(`EXISTS (
          SELECT 1
          FROM main.work_tags AS filter_work_tags
          INNER JOIN main.tags AS filter_tags ON filter_tags.id = filter_work_tags.tag_id
          WHERE filter_work_tags.work_id = works.id AND filter_tags.name = ?
        )`);
        bindings.push(tag);
      }
    } else {
      const placeholders = inClausePlaceholders(tags.length);
      conditions.push(`EXISTS (
        SELECT 1
        FROM main.work_tags AS filter_work_tags
        INNER JOIN main.tags AS filter_tags ON filter_tags.id = filter_work_tags.tag_id
        WHERE filter_work_tags.work_id = works.id
          AND filter_tags.name IN (${placeholders})
      )`);
      bindings.push(...tags);
    }
  }

  if (yearValue !== null) {
    conditions.push("substr(work_states.added_at, 1, 4) = ?");
    bindings.push(yearValue);
  }

  return { conditions, bindings };
}

export const RESUME_RESOLVED_CASE = `
  CASE WHEN EXISTS (
    SELECT 1 FROM main.playlists AS resume_playlists
    INNER JOIN main.tracks AS resume_tracks
      ON resume_tracks.playlist_id = resume_playlists.id
    WHERE resume_playlists.work_id = works.id
      AND resume_playlists.id = work_states.resume_playlist_id
      AND resume_tracks.work_id = works.id
      AND resume_tracks.id = work_states.resume_track_id
      AND work_states.resume_offset_sec >= 0
      AND (resume_tracks.end IS NULL OR work_states.resume_offset_sec <= resume_tracks.end - COALESCE(resume_tracks.start, 0))
  ) THEN 1 ELSE 0 END AS resumeResolved`;

export const JOINED_WORKS_SELECT = `
  SELECT
    works.id,
    works.title,
    works.title_sort_key AS titleSortKey,
    works.cover_image AS coverImage,
    works.cover_width AS coverWidth,
    works.cover_height AS coverHeight,
    works.default_playlist_id AS defaultPlaylistId,
    works.created_at AS createdAt,
    works.status,
    works.physical_path AS physicalPath,
    works.total_duration_sec AS totalDurationSec,
    works.track_count AS trackCount,
    works.error_message AS errorMessage,
    works.urls_json AS urlsJson,
    work_states.work_id AS workId,
    work_states.added_at AS addedAt,
    work_states.bookmarked,
    work_states.last_played_at AS lastPlayedAt,
    work_states.resume_playlist_id AS resumePlaylistId,
    work_states.resume_track_id AS resumeTrackId,
    work_states.resume_offset_sec AS resumeOffsetSec,
    ${RESUME_RESOLVED_CASE}
  FROM main.works
  INNER JOIN user.work_states ON work_states.work_id = works.id`;

export const WORKS_QUERY_FROM = `
  FROM main.works
  INNER JOIN user.work_states AS work_states ON work_states.work_id = works.id`;

export function viewConditions(view: WorksQuery["view"]): {
  conditions: string[];
  bindings: string[];
} {
  const conditions: string[] = [];
  const bindings: string[] = [];
  switch (view) {
    case "recent":
      conditions.push("work_states.last_played_at IS NOT NULL");
      break;
    case "added":
      conditions.push("work_states.added_at >= ?");
      bindings.push(new Date(Date.now() - RECENT_VIEW_WINDOW_DAYS * 86400000).toISOString());
      break;
    case "fav":
      conditions.push("work_states.bookmarked = 1");
      break;
    case "error":
      conditions.push("works.status != 'ok'");
      break;
  }
  return { conditions, bindings };
}

export function axisFacetSql(baseSelect: string): string {
  return `
    WITH base AS (${baseSelect}),
    ranked_covers AS (
      SELECT value, work_id, cover_image, cover_width, cover_height,
             ROW_NUMBER() OVER (PARTITION BY value ORDER BY added_at DESC, work_id ASC) AS rn
      FROM base
      WHERE cover_image IS NOT NULL AND cover_width IS NOT NULL AND cover_height IS NOT NULL
    ),
    covers_agg AS (
      SELECT value,
             json_group_array(
               json_object(
                 'workId', work_id,
                 'image', cover_image,
                 'dimensions', json_object('width', cover_width, 'height', cover_height)
               )
               ORDER BY rn
             ) AS covers_json
      FROM ranked_covers
      WHERE rn <= 4
      GROUP BY value
    )
    SELECT
      base.value AS value,
      COUNT(*) AS count,
      COALESCE(SUM(base.duration_sec), 0) AS durationSec,
      COALESCE(covers_agg.covers_json, '[]') AS coversJson
    FROM base
    LEFT JOIN covers_agg ON covers_agg.value = base.value
    GROUP BY base.value
    ORDER BY count DESC, base.sort_key COLLATE BINARY ASC, base.value COLLATE BINARY ASC
  `;
}

export function smartFolderRulePredicates(rules: SmartFolderRule[]): {
  predicates: string[];
  bindings: Array<string | number>;
} {
  const predicates: string[] = [];
  const bindings: Array<string | number> = [];
  for (const rule of rules) {
    switch (rule.field) {
      case "タグ": {
        const placeholders = inClausePlaceholders(rule.values.length);
        predicates.push(`EXISTS (
          SELECT 1
          FROM main.work_tags AS rule_work_tags
          INNER JOIN main.tags AS rule_tags ON rule_tags.id = rule_work_tags.tag_id
          WHERE rule_work_tags.work_id = works.id AND rule_tags.name IN (${placeholders})
        )`);
        bindings.push(...rule.values);
        break;
      }
      case "長さ": {
        const minSec = Number(rule.values[0]);
        if (!Number.isFinite(minSec)) {
          throw new Error(`スマートフォルダーの長さ条件が不正です: ${rule.values[0]}`);
        }
        predicates.push("works.total_duration_sec >= ?");
        bindings.push(minSec);
        break;
      }
      default:
        throw new Error(`未対応のスマートフォルダールールです: ${JSON.stringify(rule)}`);
    }
  }
  return { predicates, bindings };
}

// isRjCodeMissing (shared/dlsite.ts)
export const DLSITE_RJ_MISSING_CASE =
  "SUM(CASE WHEN json_extract(work_dlsite.state_json, '$.rjCode') IS NULL " +
  "AND COALESCE(json_extract(work_dlsite.state_json, '$.status'), 'none') != 'skipped' " +
  "THEN 1 ELSE 0 END)";

// isDlsiteFetchFailed (shared/dlsite.ts)
export const DLSITE_FETCH_FAILED_CASE =
  "SUM(CASE WHEN json_extract(work_dlsite.state_json, '$.status') = 'not_found' " +
  "OR (json_extract(work_dlsite.state_json, '$.status') = 'error' " +
  "AND COALESCE(json_extract(work_dlsite.state_json, '$.errorKind'), '') != 'parse_error') " +
  "THEN 1 ELSE 0 END)";

// isDlsiteParseFailed (shared/dlsite.ts)
export const DLSITE_PARSE_FAILED_CASE =
  "SUM(CASE WHEN json_extract(work_dlsite.state_json, '$.status') = 'error' " +
  "AND json_extract(work_dlsite.state_json, '$.errorKind') = 'parse_error' " +
  "THEN 1 ELSE 0 END)";

export const DLSITE_PARSE_SUCCESS_CASE =
  "SUM(CASE WHEN json_extract(work_dlsite.state_json, '$.status') = 'applied' THEN 1 ELSE 0 END)";

// isDlsiteUnlinked (shared/dlsite.ts)
export const DLSITE_UNLINKED_CASE =
  "SUM(CASE WHEN json_extract(work_dlsite.state_json, '$.rjCode') IS NOT NULL " +
  "AND json_extract(work_dlsite.state_json, '$.rjCode') != '' " +
  "AND json_extract(work_dlsite.state_json, '$.status') = 'none' THEN 1 ELSE 0 END)";

export const DLSITE_NOTIFICATION_SUMMARY_SELECT = `
  SELECT
    ${DLSITE_RJ_MISSING_CASE} AS rjCodeMissingCount,
    ${DLSITE_FETCH_FAILED_CASE} AS fetchFailedCount,
    ${DLSITE_PARSE_FAILED_CASE} AS parseErrorCount,
    ${DLSITE_PARSE_SUCCESS_CASE} AS parseSuccessCount,
    ${DLSITE_UNLINKED_CASE} AS unlinkedCount
  FROM main.works AS works
  LEFT JOIN main.work_dlsite AS work_dlsite ON work_dlsite.work_id = works.id`;

export function dlsiteNotificationWhere(kind: DlsiteNotificationKind): string {
  switch (kind) {
    case "rj-missing":
      // isRjCodeMissing (shared/dlsite.ts)
      return `json_extract(work_dlsite.state_json, '$.rjCode') IS NULL
        AND COALESCE(json_extract(work_dlsite.state_json, '$.status'), 'none') != 'skipped'`;
    case "fetch-failed":
      // isDlsiteFetchFailed (shared/dlsite.ts)
      return `(json_extract(work_dlsite.state_json, '$.status') = 'not_found'
        OR (json_extract(work_dlsite.state_json, '$.status') = 'error'
            AND COALESCE(json_extract(work_dlsite.state_json, '$.errorKind'), '') != 'parse_error'))`;
    case "parse-failed":
      // isDlsiteParseFailed (shared/dlsite.ts)
      return `json_extract(work_dlsite.state_json, '$.status') = 'error'
        AND json_extract(work_dlsite.state_json, '$.errorKind') = 'parse_error'`;
  }
}
